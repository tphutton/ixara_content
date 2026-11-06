import { prisma } from '@/lib/prisma';
import { validateTimeline, type Timeline } from '@/lib/media/timeline';
import { privateObjectKey } from '@/lib/media/private-storage';
import { McpError, type Operation } from './engine';

const sceneSchema={type:'object',properties:{assetId:{type:'string'},durationSeconds:{type:'number'},startSeconds:{type:'number'},motion:{type:'string',enum:['none','push','pull']},crop:{type:'object',properties:{x:{type:'number'},y:{type:'number'},width:{type:'number'},height:{type:'number'}},required:['x','y','width','height'],additionalProperties:false}},required:['assetId','durationSeconds'],additionalProperties:false};
const audioSchema={type:'object',properties:{assetId:{type:'string'},offsetSeconds:{type:'number'},volume:{type:'number'},loop:{type:'boolean'},fadeInSeconds:{type:'number'},fadeOutSeconds:{type:'number'}},required:['assetId'],additionalProperties:false};
export const assemblyOperations:Operation[]=[{
  name:'queue_video_assembly',scope:'ixara-content:write',mutating:true,
  description:'Prepare a private draft render from existing assets, with normalized source crops, timed captions, local stopwatch ticks and optional audio looping/fades. Does not render or publish. Start is separate.',
  inputSchema:{type:'object',properties:{planItemId:{type:'string'},scenes:{type:'array',maxItems:30,items:sceneSchema},audio:{type:'array',maxItems:3,items:audioSchema},captions:{type:'array',maxItems:300,items:{type:'object',properties:{startSeconds:{type:'number'},endSeconds:{type:'number'},text:{type:'string'}},required:['startSeconds','endSeconds','text'],additionalProperties:false}},ticks:{type:'array',maxItems:180,items:{type:'object',properties:{offsetSeconds:{type:'number'},volume:{type:'number'}},required:['offsetSeconds'],additionalProperties:false}}},required:['planItemId','scenes','audio'],additionalProperties:false},
  snapshot:async(args,tx)=>({brief:await tx.videoBrief.findUniqueOrThrow({where:{planItemId:args.planItemId}}),assets:await tx.asset.findMany({where:{id:{in:[...args.scenes,...args.audio].map((x:{assetId:string})=>x.assetId)}},orderBy:{id:'asc'}}),jobs:await tx.mediaGenerationJob.findMany({where:{provider:'local_editor',targetType:'video_assembly',targetId:args.planItemId},orderBy:{id:'asc'}})}),
  run:async(args,actor)=>prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`video-assembly:${args.planItemId}`}, 0))::text`;
    const timeline:Timeline={scenes:args.scenes,audio:args.audio,...(args.captions!==undefined?{captions:args.captions}:{}),...(args.ticks!==undefined?{ticks:args.ticks}:{})};
    const duration=validateTimeline(timeline);
    const brief=await tx.videoBrief.findUniqueOrThrow({where:{planItemId:args.planItemId}});
    const existing=await tx.mediaGenerationJob.findFirst({where:{provider:'local_editor',targetType:'video_assembly',targetId:args.planItemId,status:{in:['queued','running']}}});
    if(existing)throw new McpError(409,'A draft assembly is already pending for this video.');
    const ids=[...new Set([...timeline.scenes,...timeline.audio].map(x=>x.assetId))];
    const assets=await tx.asset.findMany({where:{id:{in:ids}}});
    if(assets.length!==ids.length)throw new McpError(400,'Some selected assets were not found.');
    let total=0;
    for(const asset of assets){
      if(!privateObjectKey(asset.metadata)||!asset.fileSize||asset.fileSize>100*1024*1024)throw new McpError(400,'Use privately stored assets up to 100 MB each.');
      total+=asset.fileSize;
      if(timeline.scenes.some(x=>x.assetId===asset.id)&&!['image/png','image/jpeg','image/webp','video/mp4'].includes(asset.mimeType||''))throw new McpError(400,'Scenes require PNG, JPEG, WebP or MP4 assets.');
      if(asset.mimeType==='video/mp4'&&timeline.scenes.some(x=>x.assetId===asset.id&&x.motion&&x.motion!=='none'))throw new McpError(400,'Image motion can only be applied to stills.');
      if(timeline.audio.some(x=>x.assetId===asset.id)&&!['audio/mpeg','audio/wav','audio/x-wav','audio/mp4'].includes(asset.mimeType||''))throw new McpError(400,'Audio tracks require MP3, WAV or M4A assets.');
    }
    if(total>250*1024*1024)throw new McpError(400,'Combined source assets exceed 250 MB.');
    const job=await tx.mediaGenerationJob.create({data:{provider:'local_editor',targetType:'video_assembly',targetId:args.planItemId,createdById:actor.id,input:{planItemId:args.planItemId,briefUpdatedAt:brief.updatedAt.toISOString(),timeline:JSON.parse(JSON.stringify(timeline)),duration,assets:assets.map(a=>({id:a.id,updatedAt:a.updatedAt.toISOString()})),startRequested:false}}});
    return {jobId:job.id,status:job.status,duration,note:'Draft timeline prepared. No render or publication has started.'};
  }),
},{
  name:'start_video_assembly',scope:'ixara-content:write',mutating:true,
  description:'Request a private draft render of one queued timeline. Does not publish.',
  inputSchema:{type:'object',properties:{jobId:{type:'string'}},required:['jobId'],additionalProperties:false},
  snapshot:async(args,tx)=>tx.mediaGenerationJob.findUniqueOrThrow({where:{id:args.jobId}}),
  run:async args=>{
    const job=await prisma.mediaGenerationJob.findUniqueOrThrow({where:{id:args.jobId}});
    if(job.provider!=='local_editor'||job.targetType!=='video_assembly'||job.status!=='queued'||!job.input||typeof job.input!=='object'||Array.isArray(job.input))throw new McpError(400,'A queued assembly is required.');
    if(process.env.RUNWAY_RUNNER_ENABLED!=='true')throw new McpError(503,'The background worker must be enabled.');
    const updated=await prisma.mediaGenerationJob.updateMany({where:{id:job.id,status:'queued',input:{equals:job.input}},data:{input:{...job.input,startRequested:true}}});
    if(updated.count!==1)throw new McpError(409,'The job changed; inspect and preview again.');
    return {jobId:job.id,status:'queued',startRequested:true,note:'The worker will render a private draft.'};
  },
},{
  name:'cancel_video_assembly',scope:'ixara-content:write',mutating:true,
  description:'Cancel a queued draft assembly that has not started. Does not delete assets.',
  inputSchema:{type:'object',properties:{jobId:{type:'string'}},required:['jobId'],additionalProperties:false},
  snapshot:async(args,tx)=>tx.mediaGenerationJob.findUniqueOrThrow({where:{id:args.jobId}}),
  run:async args=>{
    const updated=await prisma.mediaGenerationJob.updateMany({where:{id:args.jobId,provider:'local_editor',targetType:'video_assembly',status:'queued'},data:{status:'cancelled',completedAt:new Date()}});
    if(updated.count!==1)throw new McpError(409,'Only an unstarted draft assembly can be cancelled.');
    return {jobId:args.jobId,status:'cancelled'};
  },
},{
  name:'get_video_assembly',scope:'ixara-content:read',mutating:false,
  description:'Read a draft assembly job and its saved output asset.',
  inputSchema:{type:'object',properties:{jobId:{type:'string'}},required:['jobId'],additionalProperties:false},
  run:async args=>prisma.mediaGenerationJob.findFirstOrThrow({where:{id:args.jobId,provider:'local_editor',targetType:'video_assembly'},include:{outputAsset:true}}),
}];
