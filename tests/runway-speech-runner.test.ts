import { beforeEach, describe, expect, it, vi } from "vitest";
const { state, db, create, retrieve, persist } = vi.hoisted(() => {
  const state = { status: "queued", externalTaskId: null as string | null, calls: 0 };
  const task = { id: "task-1", output: ["https://provider.example/output.mp4"] };
  const request = () => Object.assign(Promise.resolve({ id: "task-1" }), { waitForTaskOutput: async () => task });
  const create = vi.fn(() => { state.calls++; return request(); });
  const retrieve = vi.fn(() => ({ waitForTaskOutput: async () => task }));
  const persist = vi.fn(async (job: any) => ({ ...job, status: "succeeded" }));
  const db = { brandCharacter: { findUniqueOrThrow: vi.fn(async () => ({ provider: "runway", providerCharacterId: "avatar", updatedAt: new Date("2026-01-01") })) }, mediaGenerationJob: { updateMany: vi.fn(async ({ data }: any) => { state.status = data.status; if (data.externalTaskId) state.externalTaskId = data.externalTaskId; return { count: 1 }; }), findUniqueOrThrow: vi.fn(async () => ({ id: "job", status: state.status, externalTaskId: state.externalTaskId })), update: vi.fn(async ({ data }: any) => { state.status = data.status; return { id: "job", targetType: "character_speech", targetId: "kit", input: {}, ...data }; }) } };
  return { state, db, create, retrieve, persist };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@runwayml/sdk", () => ({ default: class { avatarVideos = { create }; tasks = { retrieve }; }, TaskFailedError: class extends Error {}, TaskTimedOutError: class extends Error {} }));
import { processRunwaySpeechJob } from "@/lib/media/runway-speech-runner";
const input = { startRequested: true, avatarId: "avatar", characterUpdatedAt: "2026-01-01T00:00:00.000Z", text: "St Louis, 1904." };
const job = { id: "job", targetType: "character_speech", targetId: "kit", status: "queued" as const, externalTaskId: null, outputUrl: null, input };
describe("character speaking test", () => {
  beforeEach(() => { vi.clearAllMocks(); state.status = "queued"; state.externalTaskId = null; state.calls = 0; });
  it("requires a separate explicit start", async () => { await expect(processRunwaySpeechJob({ ...job, input: { ...input, startRequested: false } }, persist)).rejects.toThrow(/explicit start/); expect(create).not.toHaveBeenCalled(); });
  it("submits once, saves the task ID and persists the completed output", async () => { const result = await processRunwaySpeechJob(job, persist); expect(state.calls).toBe(1); expect(state.externalTaskId).toBe("task-1"); expect(persist).toHaveBeenCalledOnce(); expect(result.status).toBe("succeeded"); });
  it("resumes an existing task without creating another", async () => { await processRunwaySpeechJob({ ...job, status: "running", externalTaskId: "task-1" }, persist); expect(create).not.toHaveBeenCalled(); expect(retrieve).toHaveBeenCalledOnce(); });
});
