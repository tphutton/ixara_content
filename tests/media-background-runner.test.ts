import { afterEach, describe, expect, it, vi } from "vitest";
const run = vi.hoisted(() => vi.fn(async () => ({ processed: 0, results: [] })));
vi.mock("@/lib/media/runner", () => ({ runDueMediaGenerationJobs: run }));
vi.mock("@/lib/media/audio-inspection-runner", () => ({ runDueAudioInspections: vi.fn(async () => {}) }));
vi.mock("@/lib/media/assembly-runner", () => ({ runDueVideoAssemblies: vi.fn(async () => {}) }));
vi.mock("@/lib/media/video-inspection-runner", () => ({ runDueVideoInspections: vi.fn(async () => {}) }));
import { startMediaRunner } from "@/lib/media/background-runner";

describe("background runner", () => {
  afterEach(() => { const state = globalThis as typeof globalThis & { __ixaraMediaRunner?: NodeJS.Timeout }; if (state.__ixaraMediaRunner) clearInterval(state.__ixaraMediaRunner); delete state.__ixaraMediaRunner; vi.useRealTimers(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it("does not process queued jobs without an API key", async () => { vi.useFakeTimers(); vi.stubEnv("RUNWAYML_API_SECRET", ""); startMediaRunner(); await vi.advanceTimersByTimeAsync(60_000); expect(run).not.toHaveBeenCalled(); });
  it("does not start a duplicate loop in one process", async () => { vi.useFakeTimers(); vi.stubEnv("RUNWAYML_API_SECRET", "test"); startMediaRunner(); startMediaRunner(); await vi.advanceTimersByTimeAsync(30_000); expect(run).toHaveBeenCalledTimes(2); });
});
