import { describe, expect, it } from "vitest";
import { chooseDeliveryReconciliationCandidate } from "@/lib/social/meta-sync";

const publishedAt = new Date("2026-09-22T10:00:00.000Z");

describe("chooseDeliveryReconciliationCandidate", () => {
  it("selects one exact caption match inside the delivery window", () => {
    const candidate = { id: "delivery-1", captionSnapshot: "Exact caption", createdAt: new Date("2026-09-22T09:59:30.000Z") };

    expect(chooseDeliveryReconciliationCandidate([candidate], "Exact caption", publishedAt)).toEqual(candidate);
  });

  it("does not reconcile an ambiguous match", () => {
    const candidates = [
      { id: "delivery-1", captionSnapshot: "Same caption", createdAt: new Date("2026-09-22T09:59:30.000Z") },
      { id: "delivery-2", captionSnapshot: "Same caption", createdAt: new Date("2026-09-22T10:00:15.000Z") },
    ];

    expect(chooseDeliveryReconciliationCandidate(candidates, "Same caption", publishedAt)).toBeNull();
  });

  it("does not reconcile stale or different content", () => {
    const candidates = [
      { id: "delivery-1", captionSnapshot: "Exact caption", createdAt: new Date("2026-09-22T07:00:00.000Z") },
      { id: "delivery-2", captionSnapshot: "Different caption", createdAt: new Date("2026-09-22T10:00:00.000Z") },
    ];

    expect(chooseDeliveryReconciliationCandidate(candidates, "Exact caption", publishedAt)).toBeNull();
  });
});
