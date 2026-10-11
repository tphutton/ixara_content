import { MediaGenerationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ingestGeneratedMedia, isGeneratedAssetStorageConfigured } from "@/lib/media/generated-asset-storage";
import { getRunwayTask, startRunwayVideo } from "@/lib/media/providers/runway";

type JobInput = {
  prompt?: string;
  promptImage?: string | null;
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
  if (job.status === MediaGenerationStatus.queued) {
    const input = asJobInput(job.input);
    if (!input.prompt || !input.durationSeconds || !input.aspectRatio) throw new Error("Generation job is missing prompt, duration, or aspect ratio.");
    const task = await startRunwayVideo({
      prompt: input.prompt,
      promptImage: input.promptImage,
      durationSeconds: input.durationSeconds,
      aspectRatio: input.aspectRatio,
    });
    return prisma.mediaGenerationJob.update({
      where: { id: job.id },
      data: { status: MediaGenerationStatus.submitted, externalTaskId: task.id, submittedAt: new Date(), attempts: { increment: 1 }, error: null },
    });
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
    return persistOutput({ ...job, outputUrl });
  }
  if (taskStatus === "failed" || taskStatus === "cancelled") {
    return prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: taskStatus === "cancelled" ? MediaGenerationStatus.cancelled : MediaGenerationStatus.failed, error: task.failure ?? task.failureCode ?? "Runway task failed.", completedAt: new Date() } });
  }
  return prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: MediaGenerationStatus.running } });
}

export async function runDueMediaGenerationJobs(limit = 5) {
  const jobs = await prisma.mediaGenerationJob.findMany({
    where: { provider: "runway", status: { in: [MediaGenerationStatus.queued, MediaGenerationStatus.submitted, MediaGenerationStatus.running, MediaGenerationStatus.awaiting_asset] } },
    orderBy: { updatedAt: "asc" },
    take: Math.min(Math.max(limit, 1), 20),
  });
  const results = [];
  for (const job of jobs) {
    try {
      const updated = await processRunwayJob(job);
      results.push({ id: updated.id, status: updated.status, externalTaskId: updated.externalTaskId, outputUrl: updated.outputUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Media generation failed.";
      const failed = await prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: MediaGenerationStatus.failed, error: message, completedAt: new Date() } });
      results.push({ id: failed.id, status: failed.status, error: message });
    }
  }
  return { processed: results.length, results };
}
