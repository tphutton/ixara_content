import type { Operation } from "./engine";
import { approveVideoShots } from "@/lib/approvals/video-shots";
export const videoApprovalOperations: Operation[] = [{
  name: "approve_video_shots", description: "Approve a user-reviewed batch of shots without generating media. Requires approval scope.", scope: "ixara-content:approve", mutating: true,
  inputSchema: { type: "object", properties: { planItemId: { type: "string" }, shotIds: { type: "array", maxItems: 50, items: { type: "string" } }, note: { type: "string" } }, required: ["planItemId", "shotIds", "note"], additionalProperties: false },
  snapshot: async (args, tx) => ({ brief: await tx.videoBrief.findUniqueOrThrow({ where: { planItemId: args.planItemId }, include: { shots: { orderBy: { id: "asc" } } } }) }),
  run: async (args, actor) => approveVideoShots({ ...args, accessId: actor.id }),
}];
