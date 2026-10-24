import { describe, expect, it } from "vitest";
import { publishedPostBrand, metricRate, hasEngagementRate } from "@/lib/social/reporting";

describe("published post reporting", () => {
  it("uses connected brand for imported history and keeps editorial attribution", () => {
    const connectedAccount = { brandName: "StadioMate", externalAccountId: "page-1" };
    expect(publishedPostBrand({ connectedAccount })).toBe("StadioMate");
    expect(publishedPostBrand({ connectedAccount, content: { brand: "Eagles" } })).toBe("Eagles");
    expect(publishedPostBrand({ connectedAccount: { brandProfile: { brandName: "Aces" } } })).toBe("Aces");
  });
  it("keeps captured attribution when the account connection changes", () => {
    expect(publishedPostBrand({ sourceBrandName: "Original", connectedAccount: { brandName: "New" } })).toBe("Original");
    expect(publishedPostBrand({ sourceExternalAccountId: "old", connectedAccount: { externalAccountId: "new", brandName: "New" } })).toBeNull();
  });
  it("preserves actual zero rates without fabricating missing data", () => {
    expect(metricRate(0, 100)).toBe(0);
    expect(metricRate(null, 100)).toBeNull();
    expect(metricRate(5, null)).toBeNull();
    expect(metricRate(5, 0)).toBeNull();
    expect(hasEngagementRate({ engagementRate: 0 })).toBe(true);
    expect(hasEngagementRate({ engagementRate: null })).toBe(false);
    expect(hasEngagementRate(null)).toBe(false);
  });
});
