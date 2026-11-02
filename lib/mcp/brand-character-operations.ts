import type { Operation } from "./engine";
import { McpError } from "./engine";
import { prisma } from "@/lib/prisma";

const str = { type: "string" };
const schema = (properties: Record<string, unknown>, required: string[]) => ({ type: "object", properties, required, additionalProperties: false });
const characterFields = { brandProfileId: str, referenceAssetId: str, name: str, personality: str, voiceDescription: str };

async function validateCharacter(args: any, tx: any) {
  if (!args.name.trim() || args.name.trim().length > 100) throw new McpError(400, "Character name must contain 1–100 characters.");
  if (!args.personality.trim() || args.personality.length > 10000) throw new McpError(400, "Character personality must contain 1–10000 characters.");
  if (args.voiceDescription != null && args.voiceDescription.length > 2000) throw new McpError(400, "Voice description is too long.");
  const reference = await tx.brandKitReference.findFirst({ where: { brandProfileId: args.brandProfileId, assetId: args.referenceAssetId, role: "character", status: "approved" }, include: { asset: true } });
  if (!reference || !["image/png", "image/jpeg", "image/webp"].includes(reference.asset.mimeType || "")) throw new McpError(400, "Choose an approved character image from this brand kit.");
}

export const brandCharacterOperations: Operation[] = [{
  name: "list_brand_characters", description: "List saved character profiles for one brand kit. Does not call Runway.", scope: "ixara-content:read", mutating: false,
  inputSchema: schema({ brandProfileId: str }, ["brandProfileId"]),
  run: async args => prisma.brandCharacter.findMany({ where: { brandProfileId: args.brandProfileId }, orderBy: { name: "asc" } }),
}, {
  name: "create_brand_character", description: "Save a brand character profile using an approved character reference. Does not create a Runway avatar or incur credits.", scope: "ixara-content:write", mutating: true,
  inputSchema: schema(characterFields, ["brandProfileId", "referenceAssetId", "name", "personality"]),
  snapshot: async (args, tx) => ({ brand: await tx.brandProfile.findUniqueOrThrow({ where: { id: args.brandProfileId } }), references: await tx.brandKitReference.findMany({ where: { brandProfileId: args.brandProfileId, assetId: args.referenceAssetId }, include: { asset: true }, orderBy: { id: "asc" } }), characters: await tx.brandCharacter.findMany({ where: { brandProfileId: args.brandProfileId, name: args.name.trim() }, orderBy: { id: "asc" } }) }),
  guard: validateCharacter,
  run: async (args, actor) => {
    const character = await prisma.brandCharacter.create({ data: { brandProfileId: args.brandProfileId, referenceAssetId: args.referenceAssetId, name: args.name.trim(), personality: args.personality.trim(), voiceDescription: args.voiceDescription?.trim() || null } });
    await prisma.contentActionLog.create({ data: { userId: actor.id, actionType: "create", targetType: "brand_character", targetId: character.id, summary: "Created brand character profile", afterData: JSON.parse(JSON.stringify(character)), source: actor.source === "manual" ? "manual" : "ai" } });
    return character;
  },
}, {
  name: "update_brand_character", description: "Update a saved character profile. Does not update a linked Runway avatar.", scope: "ixara-content:write", mutating: true,
  inputSchema: schema({ id: str, referenceAssetId: str, name: str, personality: str, voiceDescription: str }, ["id"]),
  snapshot: async (args, tx) => {
    const character = await tx.brandCharacter.findUniqueOrThrow({ where: { id: args.id } });
    const referenceAssetId = args.referenceAssetId ?? character.referenceAssetId;
    return { character, references: await tx.brandKitReference.findMany({ where: { brandProfileId: character.brandProfileId, assetId: referenceAssetId }, include: { asset: true }, orderBy: { id: "asc" } }) };
  },
  guard: async (args, tx) => {
    const character = await tx.brandCharacter.findUniqueOrThrow({ where: { id: args.id } });
    if (character.providerCharacterId) throw new McpError(409, "Linked provider characters require a synchronised update; this operation is not available yet.");
    if (await tx.mediaGenerationJob.findFirst({ where: { provider: "runway", targetType: "brand_character", targetId: character.id, status: { in: ["queued", "submitted", "running"] } } })) throw new McpError(409, "Cancel or complete the active character job before editing.");
    if (["referenceAssetId", "name", "personality", "voiceDescription"].every(key => args[key] === undefined)) throw new McpError(400, "Provide a change.");
    await validateCharacter({ ...character, ...args }, tx);
  },
  run: async (args, actor) => {
    const before = await prisma.brandCharacter.findUniqueOrThrow({ where: { id: args.id } });
    const character = await prisma.brandCharacter.update({ where: { id: args.id }, data: { referenceAssetId: args.referenceAssetId, name: args.name?.trim(), personality: args.personality?.trim(), voiceDescription: args.voiceDescription === undefined ? undefined : args.voiceDescription.trim() || null } });
    await prisma.contentActionLog.create({ data: { userId: actor.id, actionType: "update", targetType: "brand_character", targetId: character.id, summary: "Updated brand character profile", beforeData: JSON.parse(JSON.stringify(before)), afterData: JSON.parse(JSON.stringify(character)), source: actor.source === "manual" ? "manual" : "ai" } });
    return character;
  },
}];
