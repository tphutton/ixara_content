import { prisma } from '@/lib/prisma';
import { McpError, type Operation } from './engine';
import { privateObjectKey } from '@/lib/media/private-storage';

export const audioReviewOperations: Operation[] = [{
  name:'queue_audio_inspection', scope:'ixara-content:write', mutating:true,
  description:'Prepare a transcript and editorial audio review of one private MP3 or WAV. Does not send audio or call OpenAI; starting it is separate.',
  inputSchema:{type:'object',properties:{assetId:{type:'string'},planItemId:{type:'string'}},required:['assetId','planItemId'],additionalProperties:false},
  snapshot:async(args,tx)=>({asset:await tx.asset.findUniqueOrThrow({where:{id:args.assetId}}),brief:await tx.videoBrief.findUniqueOrThrow({where:{planItemId:args.planItemId}}),jobs:await tx.mediaGenerationJob.findMany({where:{provider:'openai',targetType:'audio_inspection',targetId:args.assetId},orderBy:{id:'asc'}})}),
  run:async(args,actor)=>prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`audio-inspection:${args.assetId}`}, 0))::text`;
    const asset=await tx.asset.findUniqueOrThrow({where:{id:args.assetId}});
    const brief=await tx.videoBrief.findUniqueOrThrow({where:{planItemId:args.planItemId}});
    if(asset.mediaType!=='audio'||!privateObjectKey(asset.metadata)||!['audio/mpeg','audio/wav','audio/x-wav'].includes(asset.mimeType||'')||!asset.fileSize||asset.fileSize>10*1024*1024)throw new McpError(400,'Use a private MP3 or WAV of at most 10 MB.');
    if(!brief.script||brief.script.length>10000)throw new McpError(400,'A saved script of at most 10,000 characters is required.');
    const active=await tx.mediaGenerationJob.findFirst({where:{provider:'openai',targetType:'audio_inspection',targetId:asset.id,status:{in:['queued','submitted','running']}}});
    if(active)throw new McpError(409,'An audio inspection is already pending.');
    const job=await tx.mediaGenerationJob.create({data:{provider:'openai',targetType:'audio_inspection',targetId:asset.id,createdById:actor.id,input:{assetId:asset.id,assetUpdatedAt:asset.updatedAt.toISOString(),planItemId:args.planItemId,script:brief.script,briefUpdatedAt:brief.updatedAt.toISOString(),startRequested:false}}});
    return {jobId:job.id,status:job.status,note:'No audio has been sent and no provider call has been made.'};
  }),
},{
  name:'start_audio_inspection',scope:'ixara-content:write',mutating:true,
  description:'Request one queued audio inspection. Once applied, the configured worker sends the audio and script to OpenAI and may incur API charges.',
  inputSchema:{type:'object',properties:{jobId:{type:'string'}},required:['jobId'],additionalProperties:false},
  snapshot:async(args,tx)=>tx.mediaGenerationJob.findUniqueOrThrow({where:{id:args.jobId}}),
  run:async(args)=>{
    const job=await prisma.mediaGenerationJob.findUniqueOrThrow({where:{id:args.jobId}});
    if(job.provider!=='openai'||job.targetType!=='audio_inspection'||job.status!=='queued'||!job.input||typeof job.input!=='object'||Array.isArray(job.input))throw new McpError(400,'A queued audio inspection is required.');
    if(process.env.RUNWAY_RUNNER_ENABLED!=='true'||!process.env.OPENAI_API_KEY)throw new McpError(503,'The background worker and OpenAI API must be configured.');
    await prisma.mediaGenerationJob.update({where:{id:job.id},data:{input:{...job.input,startRequested:true}}});
    return {jobId:job.id,status:'queued',startRequested:true,note:'The worker may send audio to OpenAI and incur charges.'};
  },
},{
  name:'get_audio_inspection',scope:'ixara-content:read',mutating:false,
  description:'Read the status and saved transcript and review of an audio inspection.',
  inputSchema:{type:'object',properties:{jobId:{type:'string'}},required:['jobId'],additionalProperties:false},
  run:async args=>prisma.mediaGenerationJob.findFirstOrThrow({where:{id:args.jobId,provider:'openai',targetType:'audio_inspection'}}),
}];
