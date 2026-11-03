import { MediaGenerationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Attach only an operator-verified provider task, never submit a replacement. */
export async function attachVerifiedRunwayTask(jobId: string, taskId: string, accessId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId)) throw new Error("Provide the exact Runway task UUID.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`runway-recovery:${taskId.toLowerCase()}`}, 0))::text`;
    const before = await tx.mediaGenerationJob.findUniqueOrThrow({ where: { id: jobId } });
    if (before.provider !== "runway" || !["video_shot", "character_speech"].includes(before.targetType) || before.status !== MediaGenerationStatus.submitted || before.externalTaskId || !before.submittedAt || before.submittedAt.getTime() > Date.now() - 120_000) throw new Error("Only an unresolved submission at least two minutes old can be reconciled.");
    const existing = await tx.mediaGenerationJob.findFirst({ where: { provider: "runway", externalTaskId: { equals: taskId, mode: "insensitive" } } });
    if (existing) throw new Error("That Runway task is already linked to a job.");
    const changed = await tx.mediaGenerationJob.updateMany({ where: { id: jobId, status: MediaGenerationStatus.submitted, externalTaskId: null }, data: { externalTaskId: taskId.toLowerCase(), error: null } });
    if (changed.count !== 1) throw new Error("Job changed during reconciliation; read it again.");
    const after = await tx.mediaGenerationJob.findUniqueOrThrow({ where: { id: jobId } });
    await tx.contentActionLog.create({ data: { userId: accessId, actionType: "update", targetType: "media_generation_job", targetId: jobId, summary: "Attached operator-verified Runway task to unresolved submission", beforeData: { externalTaskId: null }, afterData: { externalTaskId: taskId.toLowerCase() }, source: "manual" } });
    return after;
  });
}

/** Cancels only an unsubmitted job; reservation stays conservative. */
export async function cancelQueuedRunwayJob(jobId: string, accessId: string) {
  return prisma.$transaction(async tx => {
    const before = await tx.mediaGenerationJob.findUniqueOrThrow({ where: { id: jobId } });
    if (before.provider !== "runway" || before.status !== MediaGenerationStatus.queued) throw new Error("Only an unsubmitted queued Runway job can be cancelled here.");
    const updated = await tx.mediaGenerationJob.updateMany({ where: { id: jobId, status: MediaGenerationStatus.queued }, data: { status: MediaGenerationStatus.cancelled, completedAt: new Date(), error: "Cancelled before submission; credit reservation retained." } });
    if (updated.count !== 1) throw new Error("Job changed; read its status before taking action.");
    await tx.contentActionLog.create({ data: { userId: accessId, actionType: "cancel", targetType: "media_generation_job", targetId: jobId, summary: "Cancelled queued Runway job before submission", beforeData: { status: before.status }, afterData: { status: "cancelled" }, source: "manual" } });
    return { id: jobId, status: "cancelled" };
  });
}
