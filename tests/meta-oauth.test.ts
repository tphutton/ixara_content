import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeForLongLivedMetaToken } from "@/lib/social/meta";

describe("exchangeForLongLivedMetaToken", () => {
  beforeEach(() => {
    process.env.META_APP_ID = "app-id";
    process.env.META_APP_SECRET = "app-secret";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exchanges the callback token for a long-lived token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: "long-lived-token",
      expires_in: 5_184_000,
      token_type: "bearer",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeForLongLivedMetaToken("short-lived-token");
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);

    expect(result.access_token).toBe("long-lived-token");
    expect(result.expires_in).toBe(5_184_000);
    expect(requestUrl.searchParams.get("grant_type")).toBe("fb_exchange_token");
    expect(requestUrl.searchParams.get("fb_exchange_token")).toBe("short-lived-token");
  });

  it("returns Meta's error when the exchange fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "Invalid OAuth access token" },
    }), { status: 400 })));

    await expect(exchangeForLongLivedMetaToken("invalid-token")).rejects.toThrow(
      "Invalid OAuth access token",
    );
  });
});
