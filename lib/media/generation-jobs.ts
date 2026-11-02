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
  additionalReferenceAssetIds?: string[];
  model?: "gen4.5" | "seedance2_mini";
  maxCredits: number;
}) {
  const brief = await prisma.videoBrief.findUniqueOrThrow({
    where: { planItemId: input.planItemId },
    include: { shots: { orderBy: { sortOrder: "asc" } }, planItem: { select: { title: true, brand: true, plan: { select: { id: true, brand: true } } } } },
  });
  const shot = input.shotId ? brief.shots.find((item) => item.id === input.shotId) : null;
  if (input.shotId && !shot) throw new Error("The selected shot does not belong to this video brief.");
  if (!shot || shot.status !== "approved") throw new Error("Choose an approved individual shot before generating.");
  const model = input.model ?? "gen4.5";
  if (!["gen4.5", "seedance2_mini"].includes(model)) throw new Error("Unsupported generation model.");
  const minDuration = model === "gen4.5" ? 2 : 4;
  const maxDuration = model === "gen4.5" ? 10 : 15;
  if (!Number.isInteger(shot.durationSeconds) || shot.durationSeconds < minDuration || shot.durationSeconds > maxDuration) throw new Error(`Each ${model} shot must be ${minDuration}–${maxDuration} seconds.`);
  const prompt = [shot.prompt.trim(), input.guidance?.trim()].filter(Boolean).join("\n\n");
  if (!prompt || prompt.length > 1000) throw new Error("The shot prompt and guidance must total 1–1000 characters.");
  const ratios = model === "gen4.5" ? ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9", "1280:720", "720:1280", "960:960", "1104:832", "832:1104", "1584:672"] : ["9:16", "16:9", "1:1", "1280:720", "720:1280", "960:960"];
  if (!ratios.includes(brief.aspectRatio)) throw new Error("Unsupported aspect ratio for this model.");
  const estimatedCredits = shot.durationSeconds * (model === "gen4.5" ? 12 : 15);
  if (!Number.isInteger(input.maxCredits) || input.maxCredits < estimatedCredits || input.maxCredits > 225) throw new Error(`Set a per-shot limit between ${estimatedCredits} and 225 credits.`);
  const brand = brief.planItem.brand ?? brief.planItem.plan.brand;
  if (!brand) throw new Error("Set a brand on the plan or item first.");
  const assetIds = [...new Set([input.referenceAssetId, ...(input.additionalReferenceAssetIds ?? [])])];
  if (assetIds.length < 1 || assetIds.length > 4 || (model === "gen4.5" && assetIds.length !== 1)) throw new Error("Gen-4.5 needs one first frame; Seedance Mini accepts one to four references.");
  const { privateObjectKey } = await import("@/lib/media/private-storage");
  const references: Array<{ id: string; assetId: string; brandProfile: { visualGuidelines: string | null } }> = [];
  for (const assetId of assetIds) {
    const reference = await prisma.brandKitReference.findFirst({ where: { assetId, status: "approved", brandProfile: { brandName: { equals: brand, mode: "insensitive" } } }, include: { asset: true, brandProfile: { select: { visualGuidelines: true } } } });
    if (!reference || !reference.asset.mimeType || !["image/png", "image/jpeg", "image/webp"].includes(reference.asset.mimeType)) throw new Error("Choose approved PNG, JPEG or WebP image references from this brand kit.");
    if (reference.asset.fileSize !== null && reference.asset.fileSize > 3_700_000) throw new Error("A reference image is too large for Runway; use a smaller image.");
    if (!privateObjectKey(reference.asset.metadata)) throw new Error("References must be stored in private media storage.");
    references.push(reference);
  }
  const reference = references[0];

  const provider = input.provider?.trim() || "runway";
  if (provider !== "runway") throw new Error("Only Runway Dev is supported.");
  const targetType = shot ? "video_shot" : "video_brief";
  const targetId = shot?.id ?? brief.id;
  return prisma.$transaction(async (tx) => {
  // All budget and reservation changes use the same plan lock.
  const planId = brief.planItem.plan.id;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`media-budget:${planId}`}, 0))::text`;
  const planBudget = await tx.contentPlan.findUniqueOrThrow({ where: { id: planId }, select: { mediaCreditBudget: true } });
  if (planBudget.mediaCreditBudget === null) throw new Error("Set a plan credit budget before queuing generation.");
  const existing = await tx.mediaGenerationJob.findFirst({
    where: { provider, targetType, targetId, status: { in: [MediaGenerationStatus.queued, MediaGenerationStatus.submitted, MediaGenerationStatus.running, MediaGenerationStatus.awaiting_asset] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    const prior = existing.input as { referenceAssetId?: string; referenceAssetIds?: string[]; model?: string; maxCredits?: number; guidance?: string | null };
    if (JSON.stringify(prior.referenceAssetIds ?? [prior.referenceAssetId]) !== JSON.stringify(assetIds) || (prior.model ?? "gen4.5") !== model || prior.maxCredits !== input.maxCredits || (prior.guidance ?? null) !== (input.guidance ?? null)) throw new Error("An active job already exists for this shot with different settings.");
    return existing;
  }

  // Keep reservations even for failures or cancellations: provider charges may
  // be ambiguous. An operator can set a new budget after reconciling spend.
  const previousJobs = await tx.mediaGenerationJob.findMany({ where: { provider: "runway", input: { path: ["planId"], equals: planId } }, select: { input: true } });
  const reserved = previousJobs.reduce((sum, item) => { const data = item.input as { estimatedCredits?: unknown }; return sum + (typeof data?.estimatedCredits === "number" && Number.isFinite(data.estimatedCredits) ? data.estimatedCredits : 0); }, 0);
  if (reserved + estimatedCredits > planBudget.mediaCreditBudget) throw new Error(`Plan credit budget exceeded: ${reserved} reserved of ${planBudget.mediaCreditBudget} credits.`);

  const job = await tx.mediaGenerationJob.create({
    data: {
      provider,
      targetType,
      targetId,
      createdById: input.accessId,
      input: jsonValue({
        planId,
        planItemId: input.planItemId,
        title: brief.planItem.title,
        briefId: brief.id,
        shotId: shot?.id ?? null,
        durationSeconds: shot?.durationSeconds ?? brief.durationSeconds,
        aspectRatio: brief.aspectRatio,
        targetPlatforms: brief.targetPlatforms,
        prompt,
        guidance: input.guidance ?? null,
        model,
        referenceAssetIds: assetIds,
        brandKitReferenceIds: references.map(item => item.id),
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
