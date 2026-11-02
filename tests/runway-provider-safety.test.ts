import { afterEach, describe, expect, it, vi } from "vitest";
import { startRunwayVideo } from "@/lib/media/providers/runway";

describe("Runway generation safeguards", () => {
  afterEach(() => vi.unstubAllGlobals());
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
