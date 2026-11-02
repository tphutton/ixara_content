import { prisma } from "@/lib/prisma";
import { privateObjectKey } from "@/lib/media/private-storage";
import type { Operation } from "./engine";

const voices = ["victoria", "vincent", "clara", "drew", "skye", "max", "morgan", "felix", "mia", "marcus", "summer", "ruby", "aurora", "jasper", "leo", "adrian", "nina", "emma", "blake", "david", "maya", "nathan", "sam", "georgia", "petra", "adam", "zach", "violet", "roman", "luna"];
const active = ["queued", "submitted", "running"] as const;
export const runwayCharacterOperations: Operation[] = [{
  name: "queue_runway_character", description: "Prepare a Runway avatar creation for a saved brand character, with a selected preset voice. Does not contact Runway; starting is a separate action.", scope: "ixara-content:write", mutating: true,
  inputSchema: { type: "object", properties: { characterId: { type: "string" }, voicePreset: { type: "string", enum: voices } }, required: ["characterId", "voicePreset"], additionalProperties: false },
  snapshot: async (args, tx) => {
    const character = await tx.brandCharacter.findUniqueOrThrow({ where: { id: args.characterId } });
    return { character, references: await tx.brandKitReference.findMany({ where: { brandProfileId: character.brandProfileId, assetId: character.referenceAssetId }, include: { asset: true }, orderBy: { id: "asc" } }), jobs: await tx.mediaGenerationJob.findMany({ where: { provider: "runway", targetType: "brand_character", targetId: character.id }, orderBy: { id: "asc" } }) };
  },
  run: async (args, actor) => prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`runway-character:${args.characterId}`}, 0))::text`;
    const character = await tx.brandCharacter.findUniqueOrThrow({ where: { id: args.characterId } });
    if (character.providerCharacterId) throw new Error("This character is already linked to a provider avatar.");
    if (character.name.length > 50) throw new Error("Runway character names must be at most 50 characters.");
    const reference = await tx.brandKitReference.findFirst({ where: { brandProfileId: character.brandProfileId, assetId: character.referenceAssetId, role: "character", status: "approved" }, include: { asset: true } });
    if (!reference || !privateObjectKey(reference.asset.metadata) || !["image/png", "image/jpeg", "image/webp"].includes(reference.asset.mimeType || "")) throw new Error("An approved private brand character image is required.");
    const existing = await tx.mediaGenerationJob.findFirst({ where: { provider: "runway", targetType: "brand_character", targetId: character.id, status: { in: [...active] } } });
    if (existing) throw new Error("A character creation is already in progress; inspect that job instead.");
    const job = await tx.mediaGenerationJob.create({ data: { provider: "runway", targetType: "brand_character", targetId: character.id, createdById: actor.id, input: { characterUpdatedAt: character.updatedAt.toISOString(), referenceAssetId: character.referenceAssetId, brandKitReferenceId: reference.id, voicePreset: args.voicePreset } } });
    await tx.contentActionLog.create({ data: { userId: actor.id, actionType: "create", targetType: "media_generation_job", targetId: job.id, summary: "Prepared Runway character creation", afterData: JSON.parse(JSON.stringify(job)), source: "ai" } });
    return { id: job.id, status: job.status, note: "No Runway call was made. Avatar creation pricing should be verified before starting." };
  }),
}, {
  name: "get_runway_character_job", description: "Read a Runway character creation job without starting it.", scope: "ixara-content:read", mutating: false,
  inputSchema: { type: "object", properties: { jobId: { type: "string" } }, required: ["jobId"], additionalProperties: false },
  run: async args => prisma.mediaGenerationJob.findFirstOrThrow({ where: { id: args.jobId, provider: "runway", targetType: "brand_character" } }),
}];
