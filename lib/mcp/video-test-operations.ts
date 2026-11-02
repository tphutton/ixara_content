import type { Operation } from "./engine";
import { prisma } from "@/lib/prisma";

/** Create a separate short production item without touching the episode storyboard. */
export const videoTestOperations: Operation[] = [{
  name: "create_video_test", description: "Create a separate short video test with one planned shot; no generation or credits are used.", scope: "ixara-content:write", mutating: true,
  inputSchema: { type: "object", properties: { planId: { type: "string" }, title: { type: "string" }, prompt: { type: "string" }, durationSeconds: { type: "integer" }, aspectRatio: { type: "string" } }, required: ["planId", "title", "prompt", "durationSeconds", "aspectRatio"], additionalProperties: false },
  snapshot: async (args, tx) => ({ plan: await tx.contentPlan.findUniqueOrThrow({ where: { id: args.planId } }) }),
  run: async (args, actor) => {
    const title = args.title.trim(), prompt = args.prompt.trim();
    if (!title || title.length > 200 || !prompt || prompt.length > 1000) throw new Error("A title and a prompt of at most 1000 characters are required.");
    if (!Number.isInteger(args.durationSeconds) || args.durationSeconds < 2 || args.durationSeconds > 15) throw new Error("Test duration must be between 2 and 15 seconds.");
    if (!["9:16", "16:9", "1:1"].includes(args.aspectRatio)) throw new Error("Choose 9:16, 16:9 or 1:1.");
    const plan = await prisma.contentPlan.findUniqueOrThrow({ where: { id: args.planId } });
    if (!plan.brand) throw new Error("Set a brand on the plan before creating a test.");
    const item = await prisma.contentPlanItem.create({ data: { planId: plan.id, itemType: "video", status: "planned", title, brand: plan.brand, brief: "Isolated video test; not part of the episode storyboard.", videoBrief: { create: { concept: title, durationSeconds: args.durationSeconds, aspectRatio: args.aspectRatio, status: "review", targetPlatforms: [], createdById: actor.id, updatedById: actor.id, shots: { create: { sortOrder: 0, title, durationSeconds: args.durationSeconds, prompt, status: "planned" } } } } }, include: { videoBrief: { include: { shots: true } } } });
    await prisma.contentActionLog.create({ data: { userId: actor.id, actionType: "create", targetType: "content_plan_item", targetId: item.id, summary: `Created isolated video test: ${title}`, afterData: JSON.parse(JSON.stringify(item)), source: "ai" } });
    return { planId: plan.id, planItemId: item.id, videoBriefId: item.videoBrief!.id, shotId: item.videoBrief!.shots[0].id, status: "planned", note: "No media generated and no credits spent." };
  },
}];
