import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFacebookPostInsights, fetchInstagramMediaInsights } from "@/lib/social/meta";
import { getInsightValue } from "@/lib/social/meta-sync";
const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
const failure = (code: number, message: string) => new Response(JSON.stringify({ error: { code, message } }), { status: 400 });
afterEach(() => vi.unstubAllGlobals());
describe("Meta insights compatibility", () => {
  it("requests current Instagram metrics and reads both result shapes", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok([{ name: "views", values: [{ value: 0 }] }]));
    vi.stubGlobal("fetch", fetcher);
    const result = await fetchInstagramMediaInsights("media", "token");
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("metric")).toBe("views,reach,total_interactions,saved,shares");
    expect(getInsightValue(result.data, "views")).toBe(0);
    expect(getInsightValue([{ name: "views", total_value: { value: 42 } }], "views")).toBe(42);
    expect(getInsightValue(result.data, "reach")).toBeNull();
  });
  it("retains supported metrics when one metric is unavailable", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(failure(100, "The value must be a valid insights metric"))
      .mockResolvedValueOnce(ok([{ name: "post_media_view", values: [{ value: 100 }] }]))
      .mockResolvedValueOnce(failure(100, "Invalid metric"));
    vi.stubGlobal("fetch", fetcher);
    const result = await fetchFacebookPostInsights("post", "token");
    expect(getInsightValue(result.data, "post_media_view")).toBe(100);
    expect(result.unavailable).toEqual(["post_clicks"]);
  });
  it("reports missing permissions without presenting them as zero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failure(200, "Requires read_insights permission")));
    const result = await fetchFacebookPostInsights("post", "token");
    expect(result.data).toEqual([]);
    expect(result.unavailable).toEqual(["post_media_view", "post_clicks"]);
  });
  it.each([190, 4, 2])("propagates auth, throttling and provider failures (%s)", async (code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failure(code, "Provider error")));
    await expect(fetchInstagramMediaInsights("media", "token")).rejects.toThrow();
  });
});
