import RunwayML from "@runwayml/sdk";
import { prisma } from "@/lib/prisma";
import { McpError, type Operation } from "./engine";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function inspect(characterId: string, avatarId: string) {
  if (!uuid.test(avatarId)) throw new McpError(400, "Provide a valid Runway avatar ID.");
  if (!process.env.RUNWAYML_API_SECRET) throw new McpError(503, "Runway API key is not configured.");
  const character = await prisma.brandCharacter.findUniqueOrThrow({ where: { id: characterId }, include: { brandProfile: { select: { brandName: true } } } });
  if (character.providerCharacterId && character.providerCharacterId !== avatarId) throw new McpError(409, "This profile is already linked to another provider character.");
  const active = await prisma.mediaGenerationJob.findFirst({ where: { provider: "runway", targetType: "brand_character", targetId: characterId, status: { in: ["queued", "submitted", "running"] } } });
  if (active) throw new McpError(409, "Complete or cancel the active character creation job first.");
  const client = new RunwayML({ maxRetries: 0, timeout: 15000 });
  let avatar;
  try { avatar = await client.avatars.retrieve(avatarId); }
  catch { throw new McpError(400, "Could not verify this avatar using Ixara Content's Runway API key. Check the ID and project access."); }
  if (avatar.status !== "READY") throw new McpError(409, `Runway character is ${avatar.status}; only ready characters can be linked.`);
  if (avatar.voice.type === "custom" && avatar.voice.deleted) throw new McpError(409, "The avatar's custom voice has been deleted.");
  return { characterId, characterName: character.name, brandName: character.brandProfile.brandName, characterUpdatedAt: character.updatedAt.toISOString(), avatarId: avatar.id, avatarName: avatar.name, avatarUpdatedAt: avatar.updatedAt, voiceType: avatar.voice.type, voiceId: avatar.voice.type === "custom" ? avatar.voice.id : avatar.voice.presetId, voiceName: avatar.voice.name ?? null };
}

export const linkRunwayCharacterOperation: Operation = {
  name: "link_existing_runway_character", description: "Verify an existing ready Runway avatar with Ixara Content's API key and link it to a brand character. Creates no avatar or video. Preview first.",
  scope: "ixara-content:write", mutating: true,
  inputSchema: { type: "object", properties: { characterId: { type: "string" }, avatarId: { type: "string" } }, required: ["characterId", "avatarId"], additionalProperties: false },
  run: async () => { throw new McpError(400, "Use preview and apply."); },
  external: {
    preview: async args => ({ ...(await inspect(args.characterId, args.avatarId)), expiresAt: new Date(Date.now() + 30 * 60000).toISOString(), note: "Links an existing character only; no generation or credits are used." }),
    apply: async (args, actor, preview) => {
      if (!preview?.expiresAt || Date.parse(preview.expiresAt) <= Date.now()) throw new McpError(409, "Preview expired; preview the link again.");
      await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`runway-character:${args.characterId}`}, 0))::text`;
      await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`runway-avatar-link:${args.avatarId.toLowerCase()}`}, 0))::text`;
      const current = await inspect(args.characterId, args.avatarId);
      for (const key of ["characterUpdatedAt", "avatarId", "avatarUpdatedAt", "voiceType", "voiceId"] as const) if (current[key] !== preview[key]) throw new McpError(409, "The character or voice changed since preview; preview again.");
      const duplicate = await prisma.brandCharacter.findFirst({ where: { provider: "runway", providerCharacterId: { equals: current.avatarId, mode: "insensitive" }, id: { not: args.characterId } } });
      if (duplicate) throw new McpError(409, "This Runway character is already linked to another brand profile.");
      const before = await prisma.brandCharacter.findUniqueOrThrow({ where: { id: args.characterId } });
      const linked = await prisma.brandCharacter.update({ where: { id: args.characterId }, data: { provider: "runway", providerCharacterId: current.avatarId, providerVoiceId: current.voiceId } });
      await prisma.contentActionLog.create({ data: { userId: actor.id, actionType: "update", targetType: "brand_character", targetId: linked.id, summary: "Linked existing verified Runway character", beforeData: JSON.parse(JSON.stringify(before)), afterData: JSON.parse(JSON.stringify(linked)), source: actor.source === "manual" ? "manual" : "ai" } });
      return { characterId: linked.id, avatarId: linked.providerCharacterId, voiceId: linked.providerVoiceId, voiceType: current.voiceType, status: "linked" };
    },
  },
};
