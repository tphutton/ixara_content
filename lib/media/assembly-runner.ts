import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { AssetSource } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prisma } from '@/lib/prisma';
import { privateAssetUrl, privateObjectKey, privateStorageClient } from './private-storage';
import { renderTimeline, inspectRenderedTimeline, type LocalMedia } from './timeline-render';
import { validateTimeline, type Timeline } from './timeline';

type AssemblyInput={planItemId:string;briefUpdatedAt:string;timeline:Timeline;assets:{id:string;updatedAt:string}[];startRequested:boolean};
const extensions:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/mp4':'m4a'};
export async function runDueVideoAssemblies(){
  const jobs=await prisma.mediaGenerationJob.findMany({where:{provider:'local_editor',targetType:'video_assembly',status:'queued',input:{path:['startRequested'],equals:true}},orderBy:{createdAt:'asc'},take:1});
  for(const job of jobs){
    const claim=await prisma.mediaGenerationJob.updateMany({where:{id:job.id,status:'queued'},data:{status:'running',attempts:{increment:1},submittedAt:new Date(),error:null}});
    if(!claim.count)continue;
    let directory:string|undefined;
    try{
      const input=job.input as unknown as AssemblyInput;
      validateTimeline(input.timeline);
      const brief=await prisma.videoBrief.findUniqueOrThrow({where:{planItemId:input.planItemId}});
      if(brief.updatedAt.toISOString()!==input.briefUpdatedAt)throw new Error('The video brief changed after the timeline was prepared.');
      directory=await mkdtemp(join(tmpdir(),'ixara-render-'));
      const {client,bucket}=privateStorageClient();
      const local=new Map<string,LocalMedia>();
      let total=0;
      for(const [index,selected] of input.assets.entries()){
        const asset=await prisma.asset.findUniqueOrThrow({where:{id:selected.id}});
        const key=privateObjectKey(asset.metadata),ext=extensions[asset.mimeType||''];
        if(asset.updatedAt.toISOString()!==selected.updatedAt||!key||!ext||!asset.fileSize||asset.fileSize>100*1024*1024)throw new Error('A source asset changed or is unavailable.');
        const obj=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
        if(!obj.Body||!obj.ContentLength||obj.ContentLength>100*1024*1024)throw new Error('A source asset is unavailable or too large.');
        total+=obj.ContentLength;if(total>250*1024*1024)throw new Error('The source assets are too large.');
        const bytes=await obj.Body.transformToByteArray();
        if(bytes.length!==obj.ContentLength)throw new Error('A source asset download was incomplete.');
        const path=join(directory,'source-'+index+'.'+ext);
        await writeFile(path,bytes);
        local.set(asset.id,{path,kind:asset.mimeType!.startsWith('image/')?'image':asset.mimeType!.startsWith('audio/')?'audio':'video'});
      }
      const output=join(directory,'draft.mp4');
      await renderTimeline(input.timeline,local,output);
      const technicalReview=await inspectRenderedTimeline(input.timeline,output);
      const info=await stat(output);
      if(!info.size||info.size>150*1024*1024)throw new Error('Draft output is empty or too large.');
      const data=await readFile(output),key='generated/video/'+job.id+'.mp4';
      await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:data,ContentType:'video/mp4',CacheControl:'private, no-store'}));
      const externalId='media-generation:'+job.id,id=randomUUID();
      const asset=await prisma.asset.upsert({where:{source_externalId:{source:AssetSource.manual,externalId}},create:{id,source:AssetSource.manual,externalId,title:'Draft video assembly',fileUrl:privateAssetUrl(id),mimeType:'video/mp4',mediaType:'video',fileSize:data.length,metadata:{storage:'private-s3',objectKey:key,generatedBy:'local_editor',generationJobId:job.id,technicalReview},tags:[],syncedAt:new Date()},update:{}});
      await prisma.mediaGenerationJob.updateMany({where:{id:job.id,status:'running'},data:{status:'succeeded',outputAssetId:asset.id,outputUrl:asset.fileUrl,completedAt:new Date(),error:null}});
    }catch(error){
      const message=error instanceof Error&&error.message.includes('ENOENT')?'Draft renderer is unavailable: FFmpeg is not installed.':'Draft rendering failed. Check source assets and timeline before retrying.';
      await prisma.mediaGenerationJob.updateMany({where:{id:job.id,status:'running'},data:{status:'failed',completedAt:new Date(),error:message}});
    }finally{if(directory)await rm(directory,{recursive:true,force:true});}
  }
}
