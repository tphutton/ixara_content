import { ContentStatus, MediaGenerationStatus, VideoBriefStatus, VideoShotStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getUnifiedProductionStatus } from "@/lib/production/status";

describe("getUnifiedProductionStatus", () => {
  it("reports a review state for a storyboard waiting on editorial approval", () => {
    expect(getUnifiedProductionStatus({ briefStatus: VideoBriefStatus.review }).key).toBe("in_review");
  });

  it("prioritizes active generation over the underlying approval state", () => {
    expect(getUnifiedProductionStatus({
      briefStatus: VideoBriefStatus.approved,
      generationStatuses: [MediaGenerationStatus.running],
    }).key).toBe("generating");
  });

  it("reports changes requested when any shot needs attention", () => {
    expect(getUnifiedProductionStatus({
      briefStatus: VideoBriefStatus.review,
      shotStatuses: [VideoShotStatus.ready, VideoShotStatus.needs_changes],
    }).key).toBe("changes_requested");
  });

  it("reports published as the terminal content state", () => {
    expect(getUnifiedProductionStatus({ contentStatus: ContentStatus.published, briefStatus: VideoBriefStatus.ready }).key).toBe("published");
  });
});
