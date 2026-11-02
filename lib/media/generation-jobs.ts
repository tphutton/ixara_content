import { MediaGenerationStatus, Prisma } from "@prisma/client";
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
  referenceAssetId: string;
  maxCredits: number;
}) {
  const brief = await prisma.videoBrief.findUniqueOrThrow({
    where: { planItemId: input.planItemId },
    include: { shots: { orderBy: { sortOrder: "asc" } }, planItem: { select: { title: true, brand: true, plan: { select: { brand: true } } } } },
  });
  const shot = input.shotId ? brief.shots.find((item) => item.id === input.shotId) : null;
  if (input.shotId && !shot) throw new Error("The selected shot does not belong to this video brief.");
  if (!shot || shot.status !== "approved") throw new Error("Choose an approved individual shot before generating.");
  if (!Number.isInteger(shot.durationSeconds) || shot.durationSeconds < 2 || shot.durationSeconds > 10) throw new Error("Each shot must be 2–10 seconds.");
  const prompt = [shot.prompt.trim(), input.guidance?.trim()].filter(Boolean).join("\n\n");
  if (!prompt || prompt.length > 1000) throw new Error("The shot prompt and guidance must total 1–1000 characters.");
  if (!["9:16", "16:9", "1:1", "4:3", "3:4", "21:9", "1280:720", "720:1280", "960:960", "1104:832", "832:1104", "1584:672"].includes(brief.aspectRatio)) throw new Error("Unsupported Gen-4.5 aspect ratio.");
  const estimatedCredits = shot.durationSeconds * 12;
  if (!Number.isInteger(input.maxCredits) || input.maxCredits < estimatedCredits || input.maxCredits > 120) throw new Error(`Set a per-shot limit between ${estimatedCredits} and 120 credits.`);
  const brand = brief.planItem.brand ?? brief.planItem.plan.brand;
  if (!brand) throw new Error("Set a brand on the plan or item first.");
  const reference = await prisma.brandKitReference.findFirst({ where: { assetId: input.referenceAssetId, status: "approved", brandProfile: { brandName: { equals: brand, mode: "insensitive" } } }, include: { asset: true, brandProfile: { select: { visualGuidelines: true } } } });
  if (!reference || !reference.asset.mimeType?.startsWith("image/")) throw new Error("Choose an approved image reference from this brand kit.");
  const { privateObjectKey } = await import("@/lib/media/private-storage");
  if (!privateObjectKey(reference.asset.metadata)) throw new Error("Reference must be stored in private media storage.");

  const provider = input.provider?.trim() || "runway";
  if (provider !== "runway") throw new Error("Only Runway Dev is supported.");
  const targetType = shot ? "video_shot" : "video_brief";
  const targetId = shot?.id ?? brief.id;
  return prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`runway:${targetId}`}, 0))::text`;
  const existing = await tx.mediaGenerationJob.findFirst({
    where: { provider, targetType, targetId, status: { in: [MediaGenerationStatus.queued, MediaGenerationStatus.submitted, MediaGenerationStatus.running, MediaGenerationStatus.awaiting_asset] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    const prior = existing.input as { referenceAssetId?: string; maxCredits?: number; guidance?: string | null };
    if (prior.referenceAssetId !== input.referenceAssetId || prior.maxCredits !== input.maxCredits || (prior.guidance ?? null) !== (input.guidance ?? null)) throw new Error("An active job already exists for this shot with different settings.");
    return existing;
  }

  const job = await tx.mediaGenerationJob.create({
    data: {
      provider,
      targetType,
      targetId,
      createdById: input.accessId,
      input: jsonValue({
        planItemId: input.planItemId,
        title: brief.planItem.title,
        briefId: brief.id,
        shotId: shot?.id ?? null,
        durationSeconds: shot?.durationSeconds ?? brief.durationSeconds,
        aspectRatio: brief.aspectRatio,
        targetPlatforms: brief.targetPlatforms,
        prompt,
        guidance: input.guidance ?? null,
        referenceAssetId: reference.assetId,
        brandKitReferenceId: reference.id,
        visualGuidelines: reference.brandProfile.visualGuidelines,
        estimatedCredits,
        maxCredits: input.maxCredits,
      }),
    },
  });

  await tx.contentActionLog.create({ data: {
    userId: input.accessId, actionType: "create", targetType: "media_generation_job", targetId: job.id,
    summary: `Queued ${provider} generation for "${brief.planItem.title}"`, afterData: jsonValue(job), source: "ai",
  } });
  return job;
  });
}
