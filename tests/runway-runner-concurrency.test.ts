import { beforeEach, describe, expect, it, vi } from "vitest";
const { state, database, provider } = vi.hoisted(() => {
  const state = { status: "queued", taskId: null as string | null, error: null as string | null };
  const job = () => ({ id: "job1", status: "queued", externalTaskId: null, outputUrl: null, targetType: "video_shot", targetId: "shot1", input: { prompt: "Watch", durationSeconds: 5, aspectRatio: "9:16", referenceAssetId: "asset1", brandKitReferenceId: "ref1", maxCredits: 60 } });
  const database = { mediaGenerationJob: {
    findMany: vi.fn(async () => [job()]),
    updateMany: vi.fn(async () => { if (state.status !== "queued") return { count: 0 }; state.status = "submitted"; return { count: 1 }; }),
    findUniqueOrThrow: vi.fn(async () => ({ ...job(), status: state.status, externalTaskId: state.taskId, error: state.error })),
    update: vi.fn(async ({ data }: { data: { status?: string; externalTaskId?: string; error?: string | null } }) => { if (data.status) state.status = data.status; if (data.externalTaskId) state.taskId = data.externalTaskId; if (data.error !== undefined) state.error = data.error; return { ...job(), status: state.status, externalTaskId: state.taskId, error: state.error }; }),
  } };
  const provider = { startRunwayVideo: vi.fn(async () => ({ id: "task1" })), getRunwayTask: vi.fn() };
  return { state, database, provider };
});
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("@/lib/media/brand-reference", () => ({ loadApprovedBrandImage: vi.fn(async () => "data:image/png;base64,AA==") }));
vi.mock("@/lib/media/providers/runway", () => provider);
vi.mock("@/lib/media/generated-asset-storage", () => ({ ingestGeneratedMedia: vi.fn(), isGeneratedAssetStorageConfigured: vi.fn() }));
import { runDueMediaGenerationJobs } from "@/lib/media/runner";
describe("generation submission", () => {
  beforeEach(() => { state.status = "queued"; state.taskId = null; state.error = null; vi.clearAllMocks(); vi.stubEnv("RUNWAYML_API_SECRET", "test-only"); });
  it("claims a queued job once even if two runners read it", async () => {
    await Promise.all([runDueMediaGenerationJobs(), runDueMediaGenerationJobs()]);
    expect(provider.startRunwayVideo).toHaveBeenCalledTimes(1);
    expect(state.taskId).toBe("task1");
  });
  it("holds an ambiguous submission instead of retrying", async () => {
    provider.startRunwayVideo.mockRejectedValueOnce(new Error("timeout"));
    await runDueMediaGenerationJobs();
    expect(state.status).toBe("submitted");
    expect(state.taskId).toBeNull();
    expect(state.error).toMatch(/outcome unknown/i);
  });
});
