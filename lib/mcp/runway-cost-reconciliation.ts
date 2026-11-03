import { prisma } from '@/lib/prisma';
import { getRunwayTask } from '@/lib/media/providers/runway';
import { McpError, digest, type Operation } from './engine';

type CostLine={id:string;taskId:string;reserved:number;charged:number};
async function verify(planId:string, ids:string[]):Promise<CostLine[]> {
  if (!ids.length || ids.length > 10 || new Set(ids).size !== ids.length) throw new McpError(400,'Choose one to ten distinct jobs.');
  const jobs = await prisma.mediaGenerationJob.findMany({where:{id:{in:ids}},orderBy:{id:'asc'}});
  if (jobs.length !== ids.length) throw new McpError(404,'A job was not found.');
  return Promise.all(jobs.map(async job => {
    const input=job.input as Record<string,unknown>;
    if (job.provider !== 'runway' || job.status !== 'succeeded' || !job.externalTaskId || !job.outputAssetId || input?.planId !== planId || typeof input.estimatedCredits !== 'number' || !Number.isInteger(input.estimatedCredits)) throw new McpError(409,'Only successful saved Runway jobs from this plan can be reconciled.');
    const task = await getRunwayTask(job.externalTaskId) as unknown as {id:string;status:string;cost?:{credits?:unknown}};
    const charged=task.cost?.credits;
    if (task.id !== job.externalTaskId || task.status?.toLowerCase() !== 'succeeded' || typeof charged !== 'number' || !Number.isInteger(charged) || charged < 0 || charged > input.estimatedCredits) throw new McpError(409,'The provider cost is unavailable or exceeds the reservation.');
    return {id:job.id,taskId:job.externalTaskId,reserved:input.estimatedCredits,charged};
  }));
}
export const runwayCostReconciliation:Operation={
  name:'reconcile_runway_job_costs',scope:'ixara-content:write',mutating:true,
  description:'Verify actual charges for successful saved Runway jobs and reconcile their reservations; failed or uncertain jobs remain reserved.',
  inputSchema:{type:'object',properties:{planId:{type:'string'},jobIds:{type:'array',maxItems:10,items:{type:'string'}}},required:['planId','jobIds'],additionalProperties:false},
  run:async()=>{throw new Error('Use preview and apply.');},
  external:{
    preview:async(args)=>({planId:args.planId,jobs:await verify(args.planId,args.jobIds),note:'Read-only verification. No reservations changed.'}),
    apply:async(args,actor,preview)=>{
      const verified=await verify(args.planId,args.jobIds);
      if(digest(verified)!==digest(preview.jobs))throw new McpError(409,'A job or provider cost changed. Preview again.');
      await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`media-budget:${args.planId}`}, 0))::text`;
      const settled=[];
      for(const line of verified){
        const job=await prisma.mediaGenerationJob.findUniqueOrThrow({where:{id:line.id}});
        const input=job.input as Record<string,unknown>;
        if(job.status!=='succeeded'||job.externalTaskId!==line.taskId||!job.outputAssetId||input.planId!==args.planId||input.estimatedCredits!==line.reserved)throw new McpError(409,'A job changed. Preview again.');
        await prisma.mediaGenerationJob.update({where:{id:job.id},data:{input:{...input,estimatedCredits:line.charged,originalEstimatedCredits:input.originalEstimatedCredits ?? line.reserved,verifiedRunwayCredits:line.charged} as never}});
        settled.push({jobId:job.id,previousReservation:line.reserved,verifiedCredits:line.charged});
      }
      await prisma.contentActionLog.create({data:{userId:actor.id,actionType:'update',targetType:'content_plan',targetId:args.planId,summary:'Reconciled successful Runway job reservations with provider charges',afterData:{jobs:settled},source:'ai'}});
      return {planId:args.planId,jobs:settled,creditsReleased:settled.reduce((n,j)=>n+j.previousReservation-j.verifiedCredits,0),note:'Only successful saved jobs with confirmed provider costs were reconciled.'};
    },
  },
};
