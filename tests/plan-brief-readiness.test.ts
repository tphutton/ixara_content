import { describe, expect, it } from "vitest";
import { getPlanItemBriefReadiness } from "@/lib/plans/brief-readiness";

const item = {
  title: "Course launch post",
  brief: "Show golfers why the new itinerary is worth booking.",
  objective: null,
  targetAudience: null,
  keyMessage: "Play a premium island course without planning friction.",
  callToAction: null,
  tone: null,
  channel: "Instagram",
  brand: "StadioMate",
  campaignName: null,
  assetRequest: "Course hero image",
};

describe("plan item production brief readiness", () => {
  it("uses plan and brand defaults when evaluating a brief", () => {
    const readiness = getPlanItemBriefReadiness(
      item,
      { goal: "Generate qualified trip enquiries", brand: "StadioMate", campaignName: "Golf trips" },
      {
        targetAudience: "Golfers planning premium trips",
        defaultTone: "Knowledgeable and direct",
        preferredCTAs: ["Explore the trip"],
      },
    );

    expect(readiness.ready).toBe(true);
    expect(readiness.score).toBe(100);
    expect(readiness.effective.objective).toBe("Generate qualified trip enquiries");
    expect(readiness.effective.callToAction).toBe("Explore the trip");
    expect(readiness.hasAssetDirection).toBe(true);
  });

  it("reports the missing production context", () => {
    const readiness = getPlanItemBriefReadiness(
      { ...item, brief: null, keyMessage: null, channel: null, brand: null },
      { goal: null, brand: null, campaignName: null },
      null,
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.missing.map((gap) => gap.key)).toEqual([
      "brief",
      "objective",
      "audience",
      "message",
      "cta",
      "tone",
      "brand",
      "channel",
    ]);
  });
});
