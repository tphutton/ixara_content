import type { Operation } from "./engine";
import { prisma } from "@/lib/prisma";

// This transaction only records intent; the independent worker makes the paid call
// after commit, claims the job atomically and never retries ambiguous submissions.
export const runwayStartOperations: Operation[] = [{
  name: "request_start_queued_runway_job", description: "Request starting one queued Runway job. After apply, an enabled worker may submit it and incur the reserved estimated credits.", scope: "ixara-content:write", mutating: true,
  inputSchema: { type: "object", properties: { jobId: { type: "string" } }, required: ["jobId"], additionalProperties: false },
  snapshot: async (args, tx) => tx.mediaGenerationJob.findUniqueOrThrow({ where: { id: args.jobId } }),
  run: async (args, actor) => {
    if (process.env.RUNWAY_RUNNER_ENABLED !== "true" || !process.env.RUNWAYML_API_SECRET) throw new Error("Runway worker and API key must be configured before requesting a start.");
    const before = await prisma.mediaGenerationJob.findUniqueOrThrow({ where: { id: args.jobId } });
    if (before.provider !== "runway" || before.status !== "queued" || !before.input || typeof before.input !== "object" || Array.isArray(before.input)) throw new Error("Only queued Runway jobs can be started.");
    const input = before.input as Record<string, unknown>;
    if (input.startRequested === true) return { id: before.id, status: before.status, startRequested: true };
    const updated = await prisma.mediaGenerationJob.updateMany({ where: { id: args.jobId, status: "queued", input: { equals: before.input } }, data: { input: { ...input, startRequested: true } as never } });
    if (updated.count !== 1) throw new Error("Job changed; inspect it before retrying.");
    await prisma.contentActionLog.create({ data: { userId: actor.id, actionType: "request_start", targetType: "media_generation_job", targetId: before.id, summary: "Requested Runway generation start", afterData: { startRequested: true }, source: actor.source === "manual" ? "manual" : "ai" } });
    return { id: before.id, status: before.status, startRequested: true, estimatedCredits: input.estimatedCredits, note: "Worker may submit this job after this change is applied." };
  },
}];
