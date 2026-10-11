import { MediaGenerationStatus, Prisma } from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { prisma } from "@/lib/prisma";

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function queueVideoGeneration(input: {
  accessId: string;
  planItemId: string;
  provider?: string;
  shotId?: string;
  guidance?: string | null;
}) {
  const brief = await prisma.videoBrief.findUniqueOrThrow({
    where: { planItemId: input.planItemId },
    include: { shots: { orderBy: { sortOrder: "asc" } }, planItem: { select: { title: true } } },
  });
  const shot = input.shotId ? brief.shots.find((item) => item.id === input.shotId) : null;
  if (input.shotId && !shot) throw new Error("The selected shot does not belong to this video brief.");
  if (brief.status !== "approved" && !shot) {
    throw new Error("Approve the video brief before queuing full-video generation.");
  }
  if (shot && shot.status !== "approved") {
    throw new Error("Approve the selected shot before queuing generation.");
  }

  const provider = input.provider?.trim() || "runway";
  const targetType = shot ? "video_shot" : "video_brief";
  const targetId = shot?.id ?? brief.id;
  const existing = await prisma.mediaGenerationJob.findFirst({
    where: { provider, targetType, targetId, status: { in: [MediaGenerationStatus.queued, MediaGenerationStatus.submitted, MediaGenerationStatus.running] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const job = await prisma.mediaGenerationJob.create({
    data: {
      provider,
      targetType,
      targetId,
      createdById: input.accessId,
      input: jsonValue({
        planItemId: input.planItemId,
        briefId: brief.id,
        shotId: shot?.id ?? null,
        durationSeconds: shot?.durationSeconds ?? brief.durationSeconds,
        aspectRatio: brief.aspectRatio,
        targetPlatforms: brief.targetPlatforms,
        prompt: shot?.prompt ?? brief.concept,
        guidance: input.guidance ?? null,
      }),
    },
  });

  await createActionLog({
    userId: input.accessId,
    actionType: "create",
    targetType: "media_generation_job",
    targetId: job.id,
    summary: `Queued ${provider} generation for "${brief.planItem.title}"`,
    afterData: job,
    source: "ai",
  });
  return job;
}
