import RunwayML, { TaskFailedError, TaskTimedOutError } from "@runwayml/sdk";
import { MediaGenerationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Job = { id: string; targetId: string; targetType: string; status: MediaGenerationStatus; externalTaskId: string | null; outputUrl: string | null; input: unknown };
type Input = { startRequested?: boolean; avatarId?: string; characterUpdatedAt?: string; text?: string; title?: string };
type Persist = (job: Job & { outputUrl: string }) => Promise<any>;

export async function processRunwaySpeechJob(job: Job, persist: Persist) {
  if (job.status === "awaiting_asset" && job.outputUrl) return persist({ ...job, outputUrl: job.outputUrl });
  const input = job.input as Input;
  const client = new RunwayML({ maxRetries: 0, timeout: 30000 });
  let result: Awaited<ReturnType<ReturnType<typeof client.tasks.retrieve>["waitForTaskOutput"]>>;
  try {
    if (job.status === "queued") {
      if (!input?.startRequested || !input.avatarId || !input.characterUpdatedAt || !input.text || input.text.trim().length > 120) throw new Error("Speaking test is missing reviewed inputs or explicit start.");
      const character = await prisma.brandCharacter.findUniqueOrThrow({ where: { id: job.targetId } });
      if (character.provider !== "runway" || character.providerCharacterId !== input.avatarId || character.updatedAt.toISOString() !== input.characterUpdatedAt) throw new Error("Character changed after queueing; review the test again.");
      const claim = await prisma.mediaGenerationJob.updateMany({ where: { id: job.id, status: "queued" }, data: { status: "submitted", submittedAt: new Date(), attempts: { increment: 1 }, error: "Submission in progress; do not retry automatically." } });
      if (!claim.count) return prisma.mediaGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
      const request = client.avatarVideos.create({ model: "gwm1_avatars", avatar: { type: "custom", avatarId: input.avatarId }, speech: { type: "text", text: input.text } });
      // Attach rejection handling before awaiting the task ID; never resubmit after an ambiguous result.
      const waiting = request.waitForTaskOutput({ timeout: 45000 }).then(value => ({ value }), error => ({ error }));
      const submitted = await request;
      const saved = await prisma.mediaGenerationJob.updateMany({ where: { id: job.id, status: "submitted", externalTaskId: null }, data: { externalTaskId: submitted.id, status: "running", error: null } });
      if (!saved.count) return prisma.mediaGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
      const settled = await waiting;
      if ("error" in settled) throw settled.error;
      result = settled.value;
    } else if (job.externalTaskId && ["submitted", "running"].includes(job.status)) {
      result = await client.tasks.retrieve(job.externalTaskId).waitForTaskOutput({ timeout: 45000 });
    } else return job;
  } catch (error) {
    if (error instanceof TaskFailedError) return prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: "failed", error: "Runway reported the speaking test failed. Inspect the task before retrying.", completedAt: new Date() } });
    if (error instanceof TaskTimedOutError) return prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: "running", error: "Runway is still processing this test." } });
    throw error;
  }
  const url = result.output?.[0];
  if (!url) throw new Error("Runway returned no output video.");
  const saved = await prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: "awaiting_asset", outputUrl: url, error: null } });
  return persist({ ...saved, outputUrl: url });
}
