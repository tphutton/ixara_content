import { processRunwaySpeechJob } from "@/lib/media/runway-speech-runner";
import { processRunwayCharacterJob } from "@/lib/media/runway-character-runner";
import { MediaGenerationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ingestGeneratedMedia, isGeneratedAssetStorageConfigured } from "@/lib/media/generated-asset-storage";
import { loadApprovedBrandImage } from "@/lib/media/brand-reference";
import { getRunwayTask, startRunwayVideo } from "@/lib/media/providers/runway";

type JobInput = {
  prompt?: string;
  shotId?: string;
  shotUpdatedAt?: string;
  model?: "gen4.5" | "seedance2_mini";
  referenceAssetIds?: string[];
  brandKitReferenceIds?: string[];
  referenceAssetId?: string;
  brandKitReferenceId?: string;
  visualGuidelines?: string | null;
  maxCredits?: number;
  durationSeconds?: number;
  aspectRatio?: string;
  title?: string;
};

function asJobInput(input: unknown): JobInput {
  if (!input || typeof input !== "object") return {};
  return input as JobInput;
}

function isTerminal(status: MediaGenerationStatus) {
  return status === MediaGenerationStatus.succeeded || status === MediaGenerationStatus.failed || status === MediaGenerationStatus.cancelled;
}

async function persistOutput(job: { id: string; outputUrl: string; targetType: string; targetId: string; input: unknown }) {
  if (!isGeneratedAssetStorageConfigured()) {
    return prisma.mediaGenerationJob.update({
      where: { id: job.id },
      data: { status: MediaGenerationStatus.awaiting_asset, outputUrl: job.outputUrl, error: "Awaiting durable media storage configuration." },
    });
  }
  const input = asJobInput(job.input);
  const asset = await ingestGeneratedMedia({
    jobId: job.id,
    outputUrl: job.outputUrl,
    title: input.title ?? "Generated video",
    targetType: job.targetType,
    targetId: job.targetId,
  });
  return prisma.mediaGenerationJob.update({
    where: { id: job.id },
    data: { status: MediaGenerationStatus.succeeded, outputAssetId: asset.id, outputUrl: asset.fileUrl, completedAt: new Date(), error: null },
  });
}

async function processRunwayJob(job: { id: string; status: MediaGenerationStatus; externalTaskId: string | null; outputUrl: string | null; targetType: string; targetId: string; input: unknown }) {
  if (job.targetType === "brand_character") return processRunwayCharacterJob(job);
  if (job.targetType === "character_speech") return processRunwaySpeechJob(job, persistOutput);
  if (job.status === MediaGenerationStatus.queued) {
    const input = asJobInput(job.input);
    if (!input.prompt || !input.durationSeconds || !input.aspectRatio) throw new Error("Generation job is missing prompt, duration, or aspect ratio.");
    if (!input.referenceAssetId || !input.brandKitReferenceId) throw new Error("Generation requires an approved first-frame reference.");
    const model = input.model ?? "gen4.5";
    if (!["gen4.5", "seedance2_mini"].includes(model)) throw new Error("Unsupported model.");
    const minDuration = model === "gen4.5" ? 2 : 4, maxDuration = model === "gen4.5" ? 10 : 15;
    if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < minDuration || input.durationSeconds > maxDuration) throw new Error("Generation duration is unsupported.");
    const credits = input.durationSeconds * (model === "gen4.5" ? 12 : 15);
    if (!Number.isInteger(input.maxCredits) || input.maxCredits! < credits || input.maxCredits! > 225) throw new Error("Generation exceeds the allowed credit limit.");
    if (!process.env.RUNWAYML_API_SECRET) throw new Error("Runway Dev API key is not configured.");
    const assetIds = input.referenceAssetIds ?? [input.referenceAssetId];
    const referenceIds = input.brandKitReferenceIds ?? [input.brandKitReferenceId];
    if (assetIds.length !== referenceIds.length || assetIds.length < 1 || assetIds.length > 4 || (model === "gen4.5" && assetIds.length !== 1)) throw new Error("Invalid image references.");
    const referenceImages = await Promise.all(assetIds.map((assetId, i) => loadApprovedBrandImage(referenceIds[i], assetId)));
    // Claim before the chargeable request. A crash or timeout after this point is
    // ambiguous: leave it for manual reconciliation, never auto-submit again.
    if (!input.shotId || input.shotId !== job.targetId || job.targetType !== "video_shot" || !input.shotUpdatedAt) throw new Error("Job is missing its reviewed shot version.");
    const claim = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "VideoShot" WHERE "id" = ${input.shotId} FOR SHARE`;
      const shot = await tx.videoShot.findUniqueOrThrow({ where: { id: input.shotId } });
      if (shot.status !== "approved" || shot.updatedAt.toISOString() !== input.shotUpdatedAt) throw new Error("Shot approval or content changed after queueing; create a new reviewed job.");
      return tx.mediaGenerationJob.updateMany({ where: { id: job.id, status: MediaGenerationStatus.queued }, data: { status: MediaGenerationStatus.submitted, submittedAt: new Date(), attempts: { increment: 1 }, error: "Submission in progress; do not retry automatically." } });
    });
    if (!claim.count) return prisma.mediaGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
    const task = await startRunwayVideo({
      prompt: input.prompt,
      model,
      referenceImages,
      durationSeconds: input.durationSeconds,
      aspectRatio: input.aspectRatio,
    });
    await prisma.mediaGenerationJob.updateMany({
      where: { id: job.id, status: MediaGenerationStatus.submitted, externalTaskId: null },
      data: { externalTaskId: task.id, error: null },
    });
    // Never overwrite a task ID that was reconciled while a request was in flight.
    return prisma.mediaGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
  }

  if (job.status === MediaGenerationStatus.awaiting_asset && job.outputUrl) {
    return persistOutput({ ...job, outputUrl: job.outputUrl });
  }
  if (!job.externalTaskId || isTerminal(job.status)) return job;
  const task = await getRunwayTask(job.externalTaskId);
  const taskStatus = task.status?.toLowerCase();
  if (taskStatus === "succeeded") {
    const outputUrl = task.output?.[0];
    if (!outputUrl) throw new Error("Runway reported success without an output URL.");
    // Preserve the provider output before attempting durable storage, so an
    // interrupted upload can be retried without regenerating (and recharging).
    const saved = await prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: MediaGenerationStatus.awaiting_asset, outputUrl, error: null } });
    return persistOutput({ ...saved, outputUrl });
  }
  if (taskStatus === "failed" || taskStatus === "cancelled") {
    return prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: taskStatus === "cancelled" ? MediaGenerationStatus.cancelled : MediaGenerationStatus.failed, error: task.failure ?? task.failureCode ?? "Runway task failed.", completedAt: new Date() } });
  }
  return prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: MediaGenerationStatus.running } });
}

export async function runSingleMediaGenerationJob(id: string) {
  const job = await prisma.mediaGenerationJob.findUniqueOrThrow({ where: { id } });
  if (job.provider !== "runway") throw new Error("Unsupported provider.");
  if (!process.env.RUNWAYML_API_SECRET) throw new Error("Runway Dev API key is not configured; the job remains unchanged.");
  if (job.status === MediaGenerationStatus.submitted && !job.externalTaskId) throw new Error("Submission outcome unknown. Check Runway before attempting another generation.");
  try { return await processRunwayJob(job); }
  catch (error) {
    const current = await prisma.mediaGenerationJob.findUniqueOrThrow({ where: { id } });
    if (current.status === MediaGenerationStatus.submitted && !current.externalTaskId) return prisma.mediaGenerationJob.update({ where: { id }, data: { error: "Submission outcome unknown. Check Runway before creating another job." } });
    if (current.externalTaskId || current.status === MediaGenerationStatus.awaiting_asset) return prisma.mediaGenerationJob.update({ where: { id }, data: { error: "Temporary task or storage error; check again without regenerating." } });
    const message = error instanceof Error ? error.message : "Generation failed.";
    return prisma.mediaGenerationJob.update({ where: { id }, data: { status: MediaGenerationStatus.failed, error: message, completedAt: new Date() } });
  }
}

export async function runDueMediaGenerationJobs(limit = 5) {
  if (!process.env.RUNWAYML_API_SECRET) return { processed: 0, results: [], reason: "Runway Dev API key is not configured." };
  const jobs = await prisma.mediaGenerationJob.findMany({
    where: { provider: "runway", OR: [{ status: MediaGenerationStatus.queued, input: { path: ["startRequested"], equals: true } }, { status: { in: [MediaGenerationStatus.submitted, MediaGenerationStatus.running] }, externalTaskId: { not: null } }, { status: MediaGenerationStatus.awaiting_asset, outputUrl: { not: null } }] },
    orderBy: { updatedAt: "asc" },
    take: Math.min(Math.max(limit, 1), 20),
  });
  const results = [];
  for (const job of jobs) {
    try {
      const updated = await processRunwayJob(job);
      results.push({ id: updated.id, status: updated.status, externalTaskId: updated.externalTaskId, outputUrl: updated.outputUrl });
    } catch (error) {
      const current = await prisma.mediaGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
      if (job.status === MediaGenerationStatus.queued && current.status === MediaGenerationStatus.submitted && !current.externalTaskId) {
        const uncertain = await prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { error: "Submission outcome unknown. Check Runway before creating another job." } });
        results.push({ id: uncertain.id, status: uncertain.status, error: uncertain.error });
        continue;
      }
      if (current.externalTaskId || current.status === MediaGenerationStatus.awaiting_asset) {
        const held = await prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { error: "Temporary task or storage error; processing can be retried without a new generation." } });
        results.push({ id: held.id, status: held.status, error: held.error });
        continue;
      }
      const message = error instanceof Error ? error.message : "Media generation failed.";
      const failed = await prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: MediaGenerationStatus.failed, error: message, completedAt: new Date() } });
      results.push({ id: failed.id, status: failed.status, error: message });
    }
  }
  return { processed: results.length, results };
}
