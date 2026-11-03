import { prisma } from "@/lib/prisma";
import { McpError, type Operation } from "./engine";

const schema = { type: "object", properties: { planId: { type: "string" }, characterId: { type: "string" }, text: { type: "string" }, estimatedSeconds: { type: "integer" }, reservedCredits: { type: "integer" } }, required: ["planId", "characterId", "text", "estimatedSeconds", "reservedCredits"], additionalProperties: false };
export const characterSpeechOperations: Operation[] = [{
  name: "queue_character_speech_test", description: "Prepare one short text-driven Runway speaking test using a linked brand character. Reserves estimated credits, not a provider-enforced spending cap. Does not contact Runway.", scope: "ixara-content:write", mutating: true, inputSchema: schema,
  snapshot: async (args, tx) => ({ plan: await tx.contentPlan.findUniqueOrThrow({ where: { id: args.planId } }), character: await tx.brandCharacter.findUniqueOrThrow({ where: { id: args.characterId }, include: { brandProfile: true } }), jobs: await tx.mediaGenerationJob.findMany({ where: { provider: "runway", input: { path: ["planId"], equals: args.planId } }, orderBy: { id: "asc" } }) }),
  run: async (args, actor) => prisma.$transaction(async tx => {
    const text = args.text.trim();
    if (!text || text.length > 120) throw new McpError(400, "A speaking test must have 1–120 characters.");
    if (!Number.isInteger(args.estimatedSeconds) || args.estimatedSeconds < 2 || args.estimatedSeconds > 30) throw new McpError(400, "Estimated duration must be 2–30 seconds.");
    const priceEstimate = Math.ceil(args.estimatedSeconds / 3) + Math.ceil(text.length / 50);
    if (!Number.isInteger(args.reservedCredits) || args.reservedCredits < priceEstimate || args.reservedCredits > 60) throw new McpError(400, `Reserve between ${priceEstimate} and 60 credits for this test.`);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`media-budget:${args.planId}`}, 0))::text`;
    const plan = await tx.contentPlan.findUniqueOrThrow({ where: { id: args.planId } });
    const character = await tx.brandCharacter.findUniqueOrThrow({ where: { id: args.characterId }, include: { brandProfile: true } });
    if (!plan.brand || plan.brand.toLowerCase() !== character.brandProfile.brandName.toLowerCase()) throw new McpError(400, "Character and production plan must have the same brand.");
    if (character.provider !== "runway" || !character.providerCharacterId) throw new McpError(400, "Link a ready Runway character first.");
    if (plan.mediaCreditBudget === null) throw new McpError(400, "Set a plan budget before queueing.");
    const previous = await tx.mediaGenerationJob.findMany({ where: { provider: "runway", input: { path: ["planId"], equals: plan.id } } });
    if (previous.some(job => job.targetType === "character_speech" && job.targetId === character.id && ["queued", "submitted", "running", "awaiting_asset"].includes(job.status))) throw new McpError(409, "An active speaking test already exists for this character and plan.");
    const reserved = previous.reduce((sum, job) => { const value = (job.input as { estimatedCredits?: unknown })?.estimatedCredits; return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0); }, 0);
    if (reserved + args.reservedCredits > plan.mediaCreditBudget) throw new McpError(400, "Plan credit budget would be exceeded by this reservation.");
    const job = await tx.mediaGenerationJob.create({ data: { provider: "runway", targetType: "character_speech", targetId: character.id, createdById: actor.id, input: { planId: plan.id, title: `${character.name} speaking test`, avatarId: character.providerCharacterId, characterUpdatedAt: character.updatedAt.toISOString(), text, estimatedSeconds: args.estimatedSeconds, estimatedProviderCredits: priceEstimate, estimatedCredits: args.reservedCredits, reservationIsNotProviderCap: true } } });
    await tx.contentActionLog.create({ data: { userId: actor.id, actionType: "create", targetType: "media_generation_job", targetId: job.id, summary: "Prepared character speaking test", afterData: JSON.parse(JSON.stringify(job)), source: "ai" } });
    return { id: job.id, status: job.status, estimatedSeconds: args.estimatedSeconds, estimatedProviderCredits: priceEstimate, reservedCredits: args.reservedCredits, note: "Estimate only: Runway bills actual output duration and does not enforce this reservation as a hard maximum. No generation has started." };
  }),
}, {
  name: "get_character_speech_test", description: "Read a saved speaking-test job and its output asset.", scope: "ixara-content:read", mutating: false,
  inputSchema: { type: "object", properties: { jobId: { type: "string" } }, required: ["jobId"], additionalProperties: false },
  run: async args => prisma.mediaGenerationJob.findFirstOrThrow({ where: { id: args.jobId, provider: "runway", targetType: "character_speech" }, include: { outputAsset: true } }),
}, {
  name: "get_pending_runway_starts", description: "List queued Runway jobs with explicit starts requested, before enabling the worker.", scope: "ixara-content:read", mutating: false,
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  run: async () => {
    const where = { provider: "runway", status: "queued" as const, input: { path: ["startRequested"], equals: true } };
    const [total, jobs] = await Promise.all([prisma.mediaGenerationJob.count({ where }), prisma.mediaGenerationJob.findMany({ where, select: { id: true, targetType: true, targetId: true, input: true }, orderBy: { createdAt: "asc" }, take: 100 })]);
    return { total, jobs, truncated: total > jobs.length };
  },
}];
