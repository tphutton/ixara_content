import { beforeEach, describe, expect, it, vi } from "vitest";
const { state, db } = vi.hoisted(() => {
  const state = { job: { id: "job1", provider: "runway", targetType: "video_shot", status: "submitted", externalTaskId: null as string | null, submittedAt: new Date(Date.now() - 300_000) }, existing: false };
  const db = { mediaGenerationJob: {
    findUniqueOrThrow: vi.fn(async () => ({ ...state.job })),
    findFirst: vi.fn(async () => state.existing ? { id: "other" } : null),
    updateMany: vi.fn(async ({ data }: { data: { externalTaskId: string } }) => { state.job.externalTaskId = data.externalTaskId; return { count: 1 }; }),
  }, contentActionLog: { create: vi.fn(async () => ({})) }, $queryRaw: vi.fn(async () => []), $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)) }; return { state, db };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { attachVerifiedRunwayTask } from "@/lib/media/recovery";
const task = "9ab5ffb4-2f5c-43a3-8a51-dcde7e8ea999";
describe("unresolved Runway task recovery", () => {
  beforeEach(() => { state.job.externalTaskId = null; state.job.status = "submitted"; state.job.submittedAt = new Date(Date.now() - 300_000); state.existing = false; });
  it("attaches an existing task without calling the generation provider", async () => { const result = await attachVerifiedRunwayTask("job1", task, "user"); expect(result.externalTaskId).toBe(task); });
  it("rejects recently submitted or already-linked tasks", async () => { state.job.submittedAt = new Date(); await expect(attachVerifiedRunwayTask("job1", task, "user")).rejects.toThrow(/two minutes/); state.job.submittedAt = new Date(Date.now()-300_000); state.existing = true; await expect(attachVerifiedRunwayTask("job1", task, "user")).rejects.toThrow(/already linked/); });
  it("rejects invalid IDs", async () => { await expect(attachVerifiedRunwayTask("job1", "bad", "user")).rejects.toThrow(/UUID/); });
});
