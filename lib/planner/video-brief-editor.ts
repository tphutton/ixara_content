import { Prisma } from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { createRecordVersion } from "@/lib/editorial/record-history";
import { prisma } from "@/lib/prisma";

type ShotEdit = {
  shotId: string;
  title?: string;
  durationSeconds?: number;
  purpose?: string | null;
  prompt?: string;
  cameraDirection?: string | null;
  visualDetails?: string | null;
  onScreenText?: string | null;
  voiceover?: string | null;
  status?: "planned" | "approved" | "generating" | "ready" | "needs_changes";
};

export async function updateVideoBrief(input: {
  accessId: string;
  planItemId: string;
  concept?: string;
  script?: string | null;
  voiceover?: string | null;
  onScreenText?: string | null;
  audioDirection?: string | null;
  visualDirection?: string | null;
  generationStrategy?: string | null;
  durationSeconds?: number;
  aspectRatio?: string;
  targetPlatforms?: string[];
  status?: "draft" | "review" | "approved" | "generating" | "ready" | "rejected";
  shotEdits?: ShotEdit[];
  changeSummary?: string;
}) {
  const before = await prisma.videoBrief.findUniqueOrThrow({
    where: { planItemId: input.planItemId },
    include: { shots: { orderBy: { sortOrder: "asc" } }, planItem: { select: { title: true } } },
  });

  const shotIds = new Set(before.shots.map((shot) => shot.id));
  for (const edit of input.shotEdits ?? []) {
    if (!shotIds.has(edit.shotId)) throw new Error(`Shot ${edit.shotId} does not belong to this video brief.`);
    const existing = before.shots.find(shot => shot.id === edit.shotId);
    const contentChanges = Object.entries(edit).some(([key, value]) => key !== "shotId" && key !== "status" && value !== undefined);
    if (existing?.status === "approved" && contentChanges) throw new Error("Return the approved shot to planned or needs changes before editing its content.");
    if (edit.durationSeconds !== undefined && (!Number.isFinite(edit.durationSeconds) || edit.durationSeconds <= 0)) {
      throw new Error("Shot duration must be a positive number.");
    }
  }

  const data: Prisma.VideoBriefUpdateInput = {
    concept: input.concept,
    script: input.script,
    voiceover: input.voiceover,
    onScreenText: input.onScreenText,
    audioDirection: input.audioDirection,
    visualDirection: input.visualDirection,
    generationStrategy: input.generationStrategy,
    durationSeconds: input.durationSeconds,
    aspectRatio: input.aspectRatio,
    targetPlatforms: input.targetPlatforms,
    status: input.status,
    updatedBy: { connect: { id: input.accessId } },
  };

  const defined = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  const updated = await prisma.$transaction(async (tx) => {
    if (input.shotEdits?.length) {
      await tx.$queryRaw`SELECT "id" FROM "VideoShot" WHERE "videoBriefId" = ${before.id} ORDER BY "id" FOR UPDATE`;
      const activeJobs = await tx.mediaGenerationJob.findMany({ where: { targetType: "video_shot", targetId: { in: input.shotEdits.map(edit => edit.shotId) }, status: { in: ["queued", "submitted", "running", "awaiting_asset"] } }, select: { targetId: true } });
      if (activeJobs.length) throw new Error("A selected shot has an active generation job. Resolve it before editing the shot.");
      const currentShots = await tx.videoShot.findMany({ where: { videoBriefId: before.id } });
      for (const edit of input.shotEdits) {
        const current = currentShots.find(shot => shot.id === edit.shotId);
        const contentChanges = Object.entries(edit).some(([key, value]) => key !== "shotId" && key !== "status" && value !== undefined);
        if (!current) throw new Error("The shot no longer exists.");
        if (current.status === "approved" && contentChanges) throw new Error("Return the approved shot to planned or needs changes before editing its content.");
      }
    }
    await tx.videoBrief.update({ where: { id: before.id }, data: defined });
    for (const edit of input.shotEdits ?? []) {
      const shotData = Object.fromEntries(
        Object.entries(edit).filter(([key, value]) => key !== "shotId" && value !== undefined),
      );
      await tx.videoShot.update({ where: { id: edit.shotId }, data: shotData });
    }
    return tx.videoBrief.findUniqueOrThrow({
      where: { id: before.id },
      include: { shots: { orderBy: { sortOrder: "asc" } }, planItem: { select: { title: true } } },
    });
  });

  await createRecordVersion({
    targetType: "video_brief",
    targetId: updated.id,
    snapshot: updated,
    createdById: input.accessId,
    source: "ai",
    changeSummary: input.changeSummary ?? `Updated storyboard with ${input.shotEdits?.length ?? 0} shot edit${input.shotEdits?.length === 1 ? "" : "s"}`,
  });
  for (const edit of input.shotEdits ?? []) {
    const shot = updated.shots.find((item) => item.id === edit.shotId);
    if (shot) {
      await createRecordVersion({
        targetType: "video_shot",
        targetId: shot.id,
        snapshot: shot,
        createdById: input.accessId,
        source: "ai",
        changeSummary: input.changeSummary ?? `Updated shot ${shot.sortOrder + 1}`,
      });
    }
  }
  await createActionLog({
    userId: input.accessId,
    actionType: "update",
    targetType: "video_brief",
    targetId: updated.id,
    summary: `Updated storyboard for "${updated.planItem.title}"`,
    beforeData: before,
    afterData: updated,
    source: "ai",
  });

  return updated;
}
