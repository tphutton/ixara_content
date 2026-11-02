import RunwayML from "@runwayml/sdk";
import { MediaGenerationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadApprovedBrandImage } from "@/lib/media/brand-reference";

const voices = ["victoria", "vincent", "clara", "drew", "skye", "max", "morgan", "felix", "mia", "marcus", "summer", "ruby", "aurora", "jasper", "leo", "adrian", "nina", "emma", "blake", "david", "maya", "nathan", "sam", "georgia", "petra", "adam", "zach", "violet", "roman", "luna"] as const;
type Voice = (typeof voices)[number];
type Job = { id: string; targetId: string; targetType: string; status: MediaGenerationStatus; externalTaskId: string | null; outputUrl: string | null; input: unknown };

export async function processRunwayCharacterJob(job: Job) {
  const input = job.input as { startRequested?: boolean; characterUpdatedAt?: string; referenceAssetId?: string; brandKitReferenceId?: string; voicePreset?: Voice };
  if (!process.env.RUNWAYML_API_SECRET) throw new Error("Runway API key is not configured.");
  // Disable SDK retries: an ambiguous create must never silently create a second avatar.
  const client = new RunwayML({ maxRetries: 0 });
  if (job.status === "queued") {
    if (!input?.startRequested || !input.characterUpdatedAt || !input.referenceAssetId || !input.brandKitReferenceId || !input.voicePreset || !voices.includes(input.voicePreset)) throw new Error("The character job is missing reviewed inputs or an explicit start.");
    const image = await loadApprovedBrandImage(input.brandKitReferenceId, input.referenceAssetId);
    const character = await prisma.brandCharacter.findUniqueOrThrow({ where: { id: job.targetId } });
    if (character.providerCharacterId || character.updatedAt.toISOString() !== input.characterUpdatedAt || character.referenceAssetId !== input.referenceAssetId) throw new Error("Character changed after queueing; inspect it before starting.");
    const claim = await prisma.mediaGenerationJob.updateMany({ where: { id: job.id, status: "queued" }, data: { status: "submitted", submittedAt: new Date(), attempts: { increment: 1 }, error: "Submission in progress; do not retry automatically." } });
    if (!claim.count) return prisma.mediaGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
    const avatar = await client.avatars.create({ name: character.name, personality: character.personality, referenceImage: image, voice: { type: "runway-live-preset", presetId: input.voicePreset } });
    await prisma.mediaGenerationJob.updateMany({ where: { id: job.id, status: "submitted", externalTaskId: null }, data: { externalTaskId: avatar.id, status: "running", error: null } });
    return prisma.mediaGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
  }
  if (!job.externalTaskId || !["running", "submitted"].includes(job.status)) return job;
  const avatar = await client.avatars.retrieve(job.externalTaskId);
  if (avatar.status === "FAILED") return prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: "failed", error: "Runway reported character creation failed; inspect the avatar before trying again.", completedAt: new Date() } });
  if (avatar.status !== "READY") return prisma.mediaGenerationJob.update({ where: { id: job.id }, data: { status: "running" } });
  return prisma.$transaction(async tx => {
    const existing = await tx.brandCharacter.findUniqueOrThrow({ where: { id: job.targetId } });
    if (existing.providerCharacterId && existing.providerCharacterId !== avatar.id) throw new Error("Character is already linked to another avatar; reconcile manually.");
    await tx.brandCharacter.update({ where: { id: job.targetId }, data: { provider: "runway", providerCharacterId: avatar.id, providerVoiceId: input.voicePreset } });
    return tx.mediaGenerationJob.update({ where: { id: job.id }, data: { status: "succeeded", error: null, completedAt: new Date() } });
  });
}
