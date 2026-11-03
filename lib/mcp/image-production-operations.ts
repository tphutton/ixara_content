import { prisma } from '@/lib/prisma';
import { McpError, type Operation } from './engine';

/** Queue a single storyboard still. No provider call happens in preview or apply. */
export const imageProductionOperations: Operation[] = [{
  name: 'queue_storyboard_image', scope: 'ixara-content:write', mutating: true,
  description: 'Reserve one Gen-4 Image storyboard still against the plan budget. Queueing does not contact Runway; start is separate.',
  inputSchema: { type: 'object', properties: { planItemId: {type:'string'}, shotId: {type:'string'}, prompt: {type:'string'}, referenceAssetId: {type:'string'}, maxCredits: {type:'integer'} }, required: ['planItemId','shotId','prompt','maxCredits'], additionalProperties:false },
  snapshot: async (args, tx) => ({ brief: await tx.videoBrief.findUniqueOrThrow({where:{planItemId:args.planItemId},include:{shots:true,planItem:{include:{plan:true}}}}), references: args.referenceAssetId ? await tx.brandKitReference.findMany({where:{assetId:args.referenceAssetId},include:{asset:true,brandProfile:true},orderBy:{id:'asc'}}) : [], jobs: await tx.mediaGenerationJob.findMany({where:{provider:'runway',input:{path:['planItemId'],equals:args.planItemId}},orderBy:{id:'asc'}}) }),
  run: async (args, actor) => {
    const prompt = args.prompt.trim();
    if (!prompt || prompt.length > 1000 || !Number.isInteger(args.maxCredits) || args.maxCredits < 5 || args.maxCredits > 20) throw new McpError(400,'A prompt and a 5–20 credit limit are required.');
    const brief = await prisma.videoBrief.findUniqueOrThrow({where:{planItemId:args.planItemId},include:{shots:true,planItem:{include:{plan:true}}}});
    const shot = brief.shots.find(s => s.id === args.shotId);
    if (!shot || !['planned','needs_changes','approved'].includes(shot.status)) throw new McpError(409,'Choose an editable shot in this brief.');
    const ratio = ({'9:16':'720:1280','16:9':'1280:720','1:1':'720:720'} as Record<string,string>)[brief.aspectRatio];
    if (!ratio) throw new McpError(400,'Unsupported aspect ratio.');
    let reference: { id:string; assetId:string } | null = null;
    if (args.referenceAssetId) {
      const brand = brief.planItem.brand ?? brief.planItem.plan.brand;
      reference = await prisma.brandKitReference.findFirst({where:{assetId:args.referenceAssetId,status:'approved',brandProfile:{brandName:{equals:brand ?? '',mode:'insensitive'}}},select:{id:true,assetId:true}});
      if (!reference) throw new McpError(400,'Use an approved image reference in this brand kit.');
    }
    const planId = brief.planItem.plan.id;
    await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`media-budget:${planId}`}, 0))::text`;
    const budget = await prisma.contentPlan.findUniqueOrThrow({where:{id:planId},select:{mediaCreditBudget:true}});
    if (budget.mediaCreditBudget === null) throw new McpError(409,'Set a plan credit budget first.');
    const jobs = await prisma.mediaGenerationJob.findMany({where:{provider:'runway',input:{path:['planId'],equals:planId}},select:{input:true}});
    const reserved = jobs.reduce((n,j)=>n + (typeof (j.input as any)?.estimatedCredits === 'number' ? (j.input as any).estimatedCredits : 0),0);
    if (reserved + args.maxCredits > budget.mediaCreditBudget) throw new McpError(409,'The plan credit budget would be exceeded.');
    const active = await prisma.mediaGenerationJob.findFirst({where:{provider:'runway',targetType:'storyboard_image',targetId:shot.id,status:{in:['queued','submitted','running','awaiting_asset']}}});
    if (active) throw new McpError(409,'An image job is already active for this shot.');
    const job = await prisma.mediaGenerationJob.create({data:{provider:'runway',targetType:'storyboard_image',targetId:shot.id,createdById:actor.id,input:{planId,planItemId:args.planItemId,shotId:shot.id,shotUpdatedAt:shot.updatedAt.toISOString(),prompt,ratio,referenceAssetId:reference?.assetId ?? null,brandKitReferenceId:reference?.id ?? null,estimatedCredits:args.maxCredits,title:`${brief.planItem.title} — ${shot.title}`}}});
    await prisma.contentActionLog.create({data:{userId:actor.id,actionType:'create',targetType:'media_generation_job',targetId:job.id,summary:'Queued storyboard image',afterData:{planId,planItemId:args.planItemId,shotId:shot.id,estimatedCredits:args.maxCredits},source:'ai'}});
    return {id:job.id,status:job.status,estimatedCredits:args.maxCredits,note:'Queued only; no media generated. Reservation is an estimate, not a provider-enforced cap.'};
  },
},{name:'get_storyboard_image_job',scope:'ixara-content:read',mutating:false,description:'Read a storyboard image job and saved asset.',inputSchema:{type:'object',properties:{jobId:{type:'string'}},required:['jobId'],additionalProperties:false},run:async args=>prisma.mediaGenerationJob.findFirstOrThrow({where:{id:args.jobId,targetType:'storyboard_image'},include:{outputAsset:true}})}];
