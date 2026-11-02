import { afterEach, describe, expect, it, vi } from "vitest";
import { startRunwayVideo } from "@/lib/media/providers/runway";

describe("Runway generation safeguards", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("sends Seedance Mini references as images rather than first or last frames", async () => {
    vi.stubEnv("RUNWAYML_API_SECRET", "test-only");
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ id: "task" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    await startRunwayVideo({ model: "seedance2_mini", prompt: "A scene", referenceImages: ["data:image/png;base64,AAA=", "data:image/png;base64,BBB="], durationSeconds: 5, aspectRatio: "9:16" });
    const payload = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({ model: "seedance2_mini", audio: false, ratio: "720:1280", promptImage: [{ uri: "data:image/png;base64,AAA=" }, { uri: "data:image/png;base64,BBB=" }] });
  });
  it("rejects longer shots instead of silently shortening them", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(startRunwayVideo({ prompt: "A runner", promptImage: "data:image/png;base64,AA==", durationSeconds: 20, aspectRatio: "9:16" })).rejects.toThrow("2–10 seconds");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects image-to-video requests without a first frame", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(startRunwayVideo({ prompt: "A runner", durationSeconds: 5, aspectRatio: "9:16" })).rejects.toThrow("first-frame");
    expect(fetch).not.toHaveBeenCalled();
  });
});
