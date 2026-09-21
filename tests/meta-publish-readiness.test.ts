import { PublishedPostStatus, ScheduleStatus, SocialPlatform } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getMetaPublishReadiness } from "@/lib/social/meta-publish";

function readySchedule(postStatus?: PublishedPostStatus) {
  return {
    id: "schedule-1",
    channel: "instagram",
    platformAccount: null,
    brand: "StadioMate",
    status: ScheduleStatus.scheduled,
    approvedById: "editor-1",
    content: {
      id: "content-1",
      title: "Golf trip",
      body: "Play somewhere memorable.",
      hook: "Your next round starts here.",
      cta: "Plan your trip.",
      platform: "instagram",
      status: "approved",
      brand: "StadioMate",
      assetImage: "https://example.com/course.jpg",
      assetCaption: null,
      primaryAsset: null,
      qualityReviews: [{ overallScore: 90, status: "approved" }],
    },
    blog: null,
    publishedPosts: postStatus ? [{ id: "post-1", status: postStatus }] : [],
  } as never;
}

const accounts = [{
  id: "account-1",
  platform: SocialPlatform.instagram,
  status: "active",
  accountName: "StadioMate",
  accountHandle: "stadiomate",
  externalAccountId: "ig-1",
  brandName: "StadioMate",
  encryptedAccessToken: "encrypted",
  metadata: { instagramBusinessAccountId: "ig-1" },
}] as never;

describe("getMetaPublishReadiness", () => {
  it("blocks a schedule that already has an in-progress delivery claim", () => {
    const result = getMetaPublishReadiness(readySchedule(PublishedPostStatus.draft), accounts);

    expect(result.ready).toBe(false);
    expect(result.reasons).toContain(
      "A Meta delivery is already in progress and must be reconciled before retrying.",
    );
  });

  it("allows a failed delivery to be retried once all other gates pass", () => {
    const result = getMetaPublishReadiness(readySchedule(PublishedPostStatus.failed), accounts);

    expect(result.reasons).not.toContain(
      "A Meta delivery is already in progress and must be reconciled before retrying.",
    );
  });
});
