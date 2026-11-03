import RunwayML, { TaskFailedError, TaskTimedOutError } from '@runwayml/sdk';
import { prisma } from '@/lib/prisma';
import { loadApprovedBrandImage } from '@/lib/media/brand-reference';

type Job = {id:string;targetId:string;targetType:string;status:string;externalTaskId:string|null;outputUrl:string|null;input:unknown};
type Input = {startRequested?:boolean;prompt?:string;ratio?:string;shotId?:string;shotUpdatedAt?:string;referenceAssetId?:string|null;brandKitReferenceId?:string|null};
export async function processRunwayImageJob(job: Job, persist: (job:any)=>Promise<any>) {
  if (job.status === 'awaiting_asset' && job.outputUrl) return persist({...job,outputUrl:job.outputUrl});
  const input = job.input as Input;
  const client = new RunwayML({maxRetries:0,timeout:30000});
  let result: any;
  try {
    if (job.status === 'queued') {
      if (!input.startRequested || !input.prompt || input.prompt.length > 1000 || !input.shotId || input.shotId !== job.targetId || !input.shotUpdatedAt || !['720:1280','1280:720','720:720'].includes(input.ratio ?? '')) throw new Error('Invalid image job inputs.');
      const reference = input.referenceAssetId && input.brandKitReferenceId ? await loadApprovedBrandImage(input.brandKitReferenceId,input.referenceAssetId) : null;
      const claim = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "VideoShot" WHERE "id" = ${input.shotId} FOR SHARE`;
        const shot = await tx.videoShot.findUniqueOrThrow({where:{id:input.shotId}});
        if (shot.updatedAt.toISOString() !== input.shotUpdatedAt || !['planned','needs_changes','approved'].includes(shot.status)) throw new Error('Storyboard changed; create a new image job.');
        return tx.mediaGenerationJob.updateMany({where:{id:job.id,status:'queued'},data:{status:'submitted',submittedAt:new Date(),attempts:{increment:1},error:'Submission in progress; do not retry automatically.'}});
      });
      if (!claim.count) return prisma.mediaGenerationJob.findUniqueOrThrow({where:{id:job.id}});
      const request = client.textToImage.create({model:'gen4_image',promptText:input.prompt,ratio:input.ratio as '720:1280'|'1280:720'|'720:720',...(reference ? {referenceImages:[{uri:reference,tag:'reference'}]} : {})});
      const waiting = request.waitForTaskOutput({timeout:45000}).then(value=>({value}),error=>({error}));
      const submitted = await request;
      const saved = await prisma.mediaGenerationJob.updateMany({where:{id:job.id,status:'submitted',externalTaskId:null},data:{externalTaskId:submitted.id,status:'running',error:null}});
      if (!saved.count) return prisma.mediaGenerationJob.findUniqueOrThrow({where:{id:job.id}});
      const settled = await waiting; if ('error' in settled) throw settled.error; result = settled.value;
    } else if (job.externalTaskId && ['submitted','running'].includes(job.status)) {
      result = await client.tasks.retrieve(job.externalTaskId).waitForTaskOutput({timeout:45000});
    } else return job;
  } catch (error) {
    if (error instanceof TaskFailedError) return prisma.mediaGenerationJob.update({where:{id:job.id},data:{status:'failed',error:'Runway reported the image task failed. Inspect before retrying.',completedAt:new Date()}});
    if (error instanceof TaskTimedOutError) return prisma.mediaGenerationJob.update({where:{id:job.id},data:{status:'running',error:'Runway is still processing this image.'}});
    throw error;
  }
  const url = result.output?.[0]; if (!url) throw new Error('Runway returned no image.');
  const saved = await prisma.mediaGenerationJob.update({where:{id:job.id},data:{status:'awaiting_asset',outputUrl:url,error:null}});
  return persist({...saved,outputUrl:url});
}
