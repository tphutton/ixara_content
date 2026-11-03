import { prisma } from '@/lib/prisma';
import { privateObjectKey } from '@/lib/media/private-storage';
import { McpError, type Operation } from './engine';

export function belongsToProduction(source:{targetType:string;targetId:string},planItemId:string,shotIds:string[]) {
  return source.targetType==='video_shot'?shotIds.includes(source.targetId):source.targetType==='video_assembly'&&source.targetId===planItemId;
}
export const videoReviewOperations:Operation[]=[{
  name:'queue_video_inspection',scope:'ixara-content:write',mutating:true,
  description:'Prepare an AI visual review of frames from one selected video generated for this production. Does not send media or call OpenAI; starting is separate.',
  inputSchema:{type:'object',properties:{planItemId:{type:'string'},sourceJobId:{type:'string'},focus:{type:'string',maxLength:1000},startSeconds:{type:'number'},durationSeconds:{type:'number'}},required:['planItemId','sourceJobId','focus','startSeconds','durationSeconds'],additionalProperties:false},
  snapshot:async(args,tx)=>({brief:await tx.videoBrief.findUniqueOrThrow({where:{planItemId:args.planItemId},include:{shots:{orderBy:{id:'asc'}}}}),source:await tx.mediaGenerationJob.findUniqueOrThrow({where:{id:args.sourceJobId},include:{outputAsset:true}}),reviews:await tx.mediaGenerationJob.findMany({where:{provider:'openai',targetType:'video_inspection',targetId:args.sourceJobId},orderBy:{id:'asc'}})}),
  run:async(args,actor)=>prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`video-inspection:${args.sourceJobId}`}, 0))::text`;
    const focus=args.focus.trim();
    if(!focus||focus.length>1000||!Number.isFinite(args.startSeconds)||args.startSeconds<0||args.startSeconds>180||!Number.isFinite(args.durationSeconds)||args.durationSeconds<1||args.durationSeconds>90)throw new McpError(400,'Provide a focus, non-negative start, and a review window of 1–90 seconds.');
    const brief=await tx.videoBrief.findUniqueOrThrow({where:{planItemId:args.planItemId},include:{shots:true}});
    const source=await tx.mediaGenerationJob.findUniqueOrThrow({where:{id:args.sourceJobId},include:{outputAsset:true}});
    const permitted=belongsToProduction(source,args.planItemId,brief.shots.map(s=>s.id));
    if(!permitted||source.status!=='succeeded'||!source.outputAsset)throw new McpError(400,'Choose a completed video shot or assembly from this production.');
    const asset=source.outputAsset;
    if(asset.mediaType!=='video'||asset.mimeType!=='video/mp4'||!privateObjectKey(asset.metadata)||!asset.fileSize||asset.fileSize>100*1024*1024)throw new McpError(400,'Use a privately stored MP4 of at most 100 MB.');
    const active=await tx.mediaGenerationJob.findFirst({where:{provider:'openai',targetType:'video_inspection',targetId:source.id,status:{in:['queued','submitted','running']}}});
    if(active)throw new McpError(409,'A video inspection is already pending for this clip.');
    const shot=brief.shots.find(s=>s.id===source.targetId);
    const job=await tx.mediaGenerationJob.create({data:{provider:'openai',targetType:'video_inspection',targetId:source.id,createdById:actor.id,input:{planItemId:args.planItemId,sourceJobId:source.id,assetId:asset.id,assetUpdatedAt:asset.updatedAt.toISOString(),briefUpdatedAt:brief.updatedAt.toISOString(),focus,shotId:shot?.id??null,shotUpdatedAt:shot?.updatedAt.toISOString()??null,shotPrompt:shot?.prompt??null,startSeconds:args.startSeconds,durationSeconds:args.durationSeconds,maxFrames:20,startRequested:false}}});
    return {jobId:job.id,status:'queued',maxFrames:20,note:'No frames have been sent and no API call has been made.'};
  }),
},{
  name:'start_video_inspection',scope:'ixara-content:write',mutating:true,
  description:'Start an explicitly selected video inspection. The worker sends sampled frames and the review focus to OpenAI and may incur API charges.',
  inputSchema:{type:'object',properties:{jobId:{type:'string'}},required:['jobId'],additionalProperties:false},
  snapshot:async(args,tx)=>tx.mediaGenerationJob.findUniqueOrThrow({where:{id:args.jobId}}),
  run:async args=>{
    const job=await prisma.mediaGenerationJob.findUniqueOrThrow({where:{id:args.jobId}});
    if(job.provider!=='openai'||job.targetType!=='video_inspection'||job.status!=='queued'||!job.input||typeof job.input!=='object'||Array.isArray(job.input))throw new McpError(400,'Choose a queued video inspection.');
    if(process.env.RUNWAY_RUNNER_ENABLED!=='true'||!process.env.OPENAI_API_KEY)throw new McpError(503,'The media worker and OpenAI API must be configured.');
    const updated=await prisma.mediaGenerationJob.updateMany({where:{id:job.id,status:'queued',input:{equals:job.input}},data:{input:{...job.input,startRequested:true}}});
    if(updated.count!==1)throw new McpError(409,'The job changed; inspect and preview again.');
    return {jobId:job.id,status:'queued',startRequested:true,note:'The worker may send sampled frames to OpenAI and incur API charges.'};
  },
},{
  name:'get_video_inspection',scope:'ixara-content:read',mutating:false,
  description:'Read the saved findings and frame timestamps for a selected video inspection; it does not return private media.',
  inputSchema:{type:'object',properties:{jobId:{type:'string'}},required:['jobId'],additionalProperties:false},
  run:async args=>prisma.mediaGenerationJob.findFirstOrThrow({where:{id:args.jobId,provider:'openai',targetType:'video_inspection'}}),
}];
