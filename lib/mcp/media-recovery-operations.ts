import type { Operation } from "./engine";
import { attachVerifiedRunwayTask } from "@/lib/media/recovery";

export const mediaRecoveryOperations: Operation[] = [{
  name: "attach_verified_runway_task", description: "Attach a user-verified existing Runway task UUID to an unresolved submission; never creates a generation. Verify the task belongs to this job in Runway before calling.", scope: "ixara-content:write", mutating: true,
  inputSchema: { type: "object", properties: { jobId: { type: "string" }, taskId: { type: "string" }, verified: { type: "boolean", enum: [true] } }, required: ["jobId", "taskId", "verified"], additionalProperties: false },
  snapshot: async (args, tx) => ({ job: await tx.mediaGenerationJob.findUniqueOrThrow({ where: { id: args.jobId } }), existing: await tx.mediaGenerationJob.findMany({ where: { provider: "runway", externalTaskId: { equals: args.taskId, mode: "insensitive" } }, orderBy: { id: "asc" } }) }),
  run: async (args, actor) => {
    const job = await attachVerifiedRunwayTask(args.jobId, args.taskId, actor.id);
    return { id: job.id, status: job.status, externalTaskId: job.externalTaskId };
  },
}];
