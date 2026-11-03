import { prisma } from '@/lib/prisma';
import { queueVideoGeneration } from '@/lib/media/generation-jobs';
import { runwayStartOperations } from './runway-start-operation';
import { McpError, type Operation } from './engine';

type BatchShot = {shotId:string;referenceAssetId:string;additionalReferenceAssetIds?:string[];model:'gen4.5'|'seedance2_mini';maxCredits:number;guidance?:string};
export async function queueVideoBatch(planItemId:string, shots:BatchShot[], accessId:string) {
  if(!shots.length||shots.length>5||new Set(shots.map(x=>x.shotId)).size!==shots.length)throw new McpError(400,'Choose one to five distinct shots.');
  const jobs=[];
  for(const shot of shots)jobs.push(await queueVideoGeneration({planItemId,accessId,...shot}));
  return {jobs:jobs.map(job=>({id:job.id,targetId:job.targetId,status:job.status,estimatedCredits:(job.input as {estimatedCredits?:number})?.estimatedCredits})),note:'Jobs are queued only. No Runway calls have been requested.'};
}
const shotSchema={type:'object',properties:{shotId:{type:'string'},referenceAssetId:{type:'string'},additionalReferenceAssetIds:{type:'array',maxItems:3,items:{type:'string'}},model:{type:'string',enum:['gen4.5','seedance2_mini']},maxCredits:{type:'number'},guidance:{type:'string'}},required:['shotId','referenceAssetId','model','maxCredits'],additionalProperties:false};
export const videoBatchOperations:Operation[]=[{
  name:'queue_video_batch',scope:'ixara-content:write',mutating:true,
  description:'Queue one to five approved shots atomically with their selected references and per-shot estimates. Does not start Runway. A separate batch start is required.',
  inputSchema:{type:'object',properties:{planItemId:{type:'string'},shots:{type:'array',maxItems:5,items:shotSchema}},required:['planItemId','shots'],additionalProperties:false},
  snapshot:async(args,tx)=>{
    const brief=await tx.videoBrief.findUniqueOrThrow({where:{planItemId:args.planItemId},include:{shots:{orderBy:{id:'asc'}},planItem:{include:{plan:true}}}});
    const assetIds=args.shots.flatMap((s:BatchShot)=>[s.referenceAssetId,...(s.additionalReferenceAssetIds||[])]);
    return {brief,references:await tx.brandKitReference.findMany({where:{assetId:{in:assetIds}},include:{asset:true,brandProfile:true},orderBy:{id:'asc'}}),jobs:await tx.mediaGenerationJob.findMany({where:{provider:'runway',input:{path:['planId'],equals:brief.planItem.plan.id}},orderBy:{id:'asc'}})};
  },
  run:async(args,actor)=>queueVideoBatch(args.planItemId,args.shots,actor.id),
},{
  name:'start_video_batch',scope:'ixara-content:write',mutating:true,
  description:'Request Runway submission of one to five queued jobs atomically. An enabled worker may incur their reserved estimated credits.',
  inputSchema:{type:'object',properties:{jobIds:{type:'array',maxItems:5,items:{type:'string'}}},required:['jobIds'],additionalProperties:false},
  snapshot:async(args,tx)=>tx.mediaGenerationJob.findMany({where:{id:{in:args.jobIds}},orderBy:{id:'asc'}}),
  run:async(args,actor)=>{
    if(!args.jobIds.length||args.jobIds.length>5||new Set(args.jobIds).size!==args.jobIds.length)throw new McpError(400,'Choose one to five distinct jobs.');
    const results=[];
    for(const jobId of args.jobIds)results.push(await runwayStartOperations[0].run({jobId},actor));
    return {jobs:results,note:'The worker may submit these jobs after this request is applied.'};
  },
}];
