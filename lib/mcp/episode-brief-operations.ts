import type { Operation } from './engine';
import { McpError } from './engine';
import { prisma } from '@/lib/prisma';

const str = { type: 'string' };
const shot = { type: 'object', properties: { title: str, durationSeconds: { type: 'integer' }, prompt: str, voiceover: str, visualDetails: str }, required: ['title', 'durationSeconds', 'prompt'], additionalProperties: false };

/** Create-only: copy the linked source verbatim and never replace an existing storyboard. */
export const episodeBriefOperations: Operation[] = [{
  name: 'create_episode_video_brief', description: 'Create a review-stage episode storyboard from the linked content script and supplied shots. No media is generated.', scope: 'ixara-content:write', mutating: true,
  inputSchema: { type: 'object', properties: { planItemId: str, durationSeconds: { type: 'integer' }, aspectRatio: { type: 'string', enum: ['9:16', '16:9', '1:1'] }, visualDirection: str, audioDirection: str, generationStrategy: str, shots: { type: 'array', maxItems: 30, items: shot } }, required: ['planItemId', 'durationSeconds', 'aspectRatio', 'visualDirection', 'audioDirection', 'generationStrategy', 'shots'], additionalProperties: false },
  snapshot: async (args, tx) => ({ item: await tx.contentPlanItem.findUniqueOrThrow({ where: { id: args.planItemId }, include: { content: true, videoBrief: true } }) }),
  guard: async (args, tx) => {
    const item = await tx.contentPlanItem.findUniqueOrThrow({ where: { id: args.planItemId }, include: { content: true, videoBrief: true } });
    if (item.itemType !== 'video' || !item.content?.body?.trim()) throw new McpError(409, 'A video item linked to a saved script is required.');
    if (item.videoBrief) throw new McpError(409, 'A video brief already exists; it will not be replaced.');
    if (['approved', 'ready', 'published', 'completed'].includes(item.status)) throw new McpError(409, 'Return this item to review before creating a brief.');
    if (args.durationSeconds < 1 || args.durationSeconds > 180 || args.shots.length < 1) throw new McpError(400, 'Provide 1–30 shots and a duration of 1–180 seconds.');
    if (args.shots.some((s: any) => !s.title.trim() || !s.prompt.trim() || s.durationSeconds < 1 || s.durationSeconds > 180 || s.title.length > 200 || s.prompt.length > 2000)) throw new McpError(400, 'Each shot requires a title, prompt and valid duration.');
    if (args.shots.reduce((n: number, s: any) => n + s.durationSeconds, 0) !== args.durationSeconds) throw new McpError(400, 'Shot durations must add up to the brief duration.');
  },
  run: async (args, actor) => {
    const item = await prisma.contentPlanItem.findUniqueOrThrow({ where: { id: args.planItemId }, include: { content: true } });
    const brief = await prisma.videoBrief.create({ data: { planItemId: item.id, concept: item.title, durationSeconds: args.durationSeconds, aspectRatio: args.aspectRatio, targetPlatforms: item.channel ? [item.channel] : [], script: item.content!.body, visualDirection: args.visualDirection, audioDirection: args.audioDirection, generationStrategy: args.generationStrategy, status: 'review', createdById: actor.id, updatedById: actor.id, shots: { create: args.shots.map((s: any, i: number) => ({ sortOrder: i, title: s.title, durationSeconds: s.durationSeconds, prompt: s.prompt, voiceover: s.voiceover, visualDetails: s.visualDetails, status: 'planned' })) } }, include: { shots: { orderBy: { sortOrder: 'asc' } } } });
    await prisma.contentActionLog.create({ data: { userId: actor.id, actionType: 'create', targetType: 'video_brief', targetId: brief.id, summary: `Created episode storyboard: ${item.title}`, afterData: JSON.parse(JSON.stringify(brief)), source: 'ai' } });
    return { planItemId: item.id, videoBriefId: brief.id, shotCount: brief.shots.length, durationSeconds: brief.durationSeconds, status: brief.status, note: 'Copied linked script verbatim; no media generated or credits spent.' };
  },
}];
