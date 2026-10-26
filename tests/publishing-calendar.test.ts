import { describe, it, expect } from "vitest";
import {
  calendarDay,
  calendarTime,
  combineCalendarEntries,
  safeMediaUrl,
  type CalendarEntry,
} from "@/lib/schedule/calendar";
import { assertPublicationEvidence } from "@/lib/social/publication-link";
const entry = (
  id: string,
  kind: "schedule" | "published",
  scheduleId: string | null,
): CalendarEntry => ({
  id,
  kind,
  scheduleId,
  title: "Launch",
  date: "2026-10-26T07:00:00Z",
  status: kind === "published" ? "published" : "planned",
  brand: "Cup",
  platform: "instagram",
  account: "Cup",
  caption: "",
  campaign: null,
  contentId: null,
  contentTitle: null,
  mediaUrl: null,
  thumbnail: null,
  externalUrl: null,
  metrics: null,
  syncedAt: null,
  notes: null,
});
describe("unified publication calendar", () => {
  it("uses Bangkok days and times across the UTC day boundary", () => {
    expect(calendarDay("2026-10-26T18:00:00Z")).toBe("2026-10-27");
    expect(calendarTime("2026-10-28T11:30:00Z")).toBe("18:30");
  });
  it("shows unmatched imports and suppresses only the exact linked planned card", () => {
    const rows = combineCalendarEntries(
      [entry("slot", "schedule", "slot"), entry("other", "schedule", "other")],
      [
        entry("post", "published", "slot"),
        entry("unmatched", "published", null),
      ],
    );
    expect(rows.map((x) => x.id)).toEqual(["other", "post", "unmatched"]);
  });
  it("keeps distinct publications for different platforms/creative variants", () => {
    expect(
      combineCalendarEntries(
        [],
        [entry("a", "published", "slot"), entry("b", "published", "slot")],
      ),
    ).toHaveLength(2);
  });
  it("rejects unsafe media URLs", () => {
    expect(safeMediaUrl("javascript:alert(1)")).toBeNull();
    expect(safeMediaUrl("https://example.com/image.png")).toBe(
      "https://example.com/image.png",
    );
  });
});
describe("provider-evidence linking", () => {
  const post = {
    status: "published",
    externalPostId: "provider-id",
    importedAt: new Date(),
    publishedAt: new Date(),
  };
  it("allows a genuine same-brand provider publication", () =>
    expect(() => assertPublicationEvidence(post, "Cup", "cup")).not.toThrow());
  it("rejects cross-brand, unverified or undated publication", () => {
    expect(() => assertPublicationEvidence(post, "Other", "Cup")).toThrow();
    expect(() =>
      assertPublicationEvidence({ ...post, importedAt: null }, "Cup", "Cup"),
    ).toThrow();
    expect(() =>
      assertPublicationEvidence({ ...post, publishedAt: null }, "Cup", "Cup"),
    ).toThrow();
    expect(() =>
      assertPublicationEvidence({ ...post, status: "draft" }, "Cup", "Cup"),
    ).toThrow();
  });
});
