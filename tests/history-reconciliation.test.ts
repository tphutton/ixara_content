import { describe, expect, it } from "vitest";
import { validateHistoryArgs, validateHistoryLink, scheduleHistoryTitle } from "@/lib/social/history-reconciliation";
const schedule = { id: "slot", status: "published", channel: "Instagram", brand: "StadioMate", contentId: null, blogId: null, scheduledFor: new Date("2026-04-05T12:00:00Z"), publishedPosts: [] };
const post = { id: "post", status: "published", platform: "instagram", externalPostId: "provider-post", importedAt: new Date(), publishedAt: new Date("2026-04-05T08:00:00Z"), scheduleId: null, contentId: null, blogId: null, sourceBrandName: "StadioMate" };
describe("audited history reconciliation", () => {
  it("accepts actual same-brand publication evidence without requiring a content draft", () => {
    expect(() => validateHistoryArgs({ id: "slot", publishedPostId: "post" })).not.toThrow();
    expect(() => validateHistoryLink(schedule, post)).not.toThrow();
  });
  it("cannot change status, content, planned dates or any ordinary editorial field", () => {
    for (const key of ["status", "contentId", "scheduledFor", "body", "notes"]) {
      expect(() => validateHistoryArgs({ id: "slot", publishedPostId: "post", [key]: "changed" })).toThrow();
    }
  });
  it("does not use a feed post as evidence for a Story or another brand/channel", () => {
    expect(() => validateHistoryLink({ ...schedule, channel: "Instagram Story" }, post)).toThrow();
    expect(() => validateHistoryLink({ ...schedule, channel: "Facebook" }, post)).toThrow();
    expect(() => validateHistoryLink(schedule, { ...post, sourceBrandName: "Eagles & Aces Cup" })).toThrow();
    expect(() => validateHistoryLink(schedule, { ...post, sourceBrandName: "Eagles & Aces Cup", content: { brand: "StadioMate" } })).toThrow();
  });
  it("rejects unverified, old or already-linked evidence", () => {
    for (const patch of [{ importedAt: null }, { externalPostId: null }, { status: "draft" }, { publishedAt: new Date("2025-01-01") }, { scheduleId: "another-slot" }, { contentId: "other-content" }]) {
      expect(() => validateHistoryLink(schedule, { ...post, ...patch })).toThrow();
    }
    expect(() => validateHistoryLink({ ...schedule, publishedPosts: [{ id: "other-post" }] }, post)).toThrow();
    expect(() => validateHistoryLink({ ...schedule, status: "scheduled" }, post)).toThrow();
  });
  it("shows imported titles and labels manual history without inventing publication evidence", () => {
    expect(scheduleHistoryTitle({ ...schedule, publishedPosts: [{ titleSnapshot: "Vattanac Golf Resort" }] })).toBe("Vattanac Golf Resort");
    expect(scheduleHistoryTitle(schedule)).toBe("Legacy Instagram entry — 2026-04-05");
  });
});
