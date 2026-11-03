import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CalendarEntry } from "@/lib/schedule/calendar";
vi.mock("@/app/(app)/schedule/actions", () => ({
  linkImportedPublicationAction: vi.fn(),
  rescheduleCalendarAction: vi.fn(),
  undoCalendarMoveAction: vi.fn(),
}));
import { PublishingCalendar } from "@/components/schedule/publishing-calendar";

function entry(id: string, date: string, patch: Partial<CalendarEntry> = {}): CalendarEntry {
  return {
    id, date, kind: "schedule", title: `Post ${id}`, status: "planned",
    brand: "StadioMate", platform: "Instagram", account: "StadioMate",
    caption: "Caption", campaign: null, contentId: id, contentTitle: null,
    scheduleId: id, mediaUrl: null, thumbnail: null, externalUrl: null,
    metrics: null, syncedAt: null, notes: null, movable: true,
    ...patch,
  };
}
function render(entries: CalendarEntry[], props: Partial<React.ComponentProps<typeof PublishingCalendar>> = {}) {
  return renderToStaticMarkup(React.createElement(PublishingCalendar, {
    entries, campaigns: [], contentOptions: [], ...props,
  }));
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T17:30:00Z")); });
afterEach(() => vi.useRealTimers());

describe("agenda periods", () => {
  it("opens at today in Bangkok by default, regardless of an old month anchor", () => {
    const html = render([
      entry("past", "2026-11-02T16:59:00Z"),
      entry("today", "2026-11-02T17:01:00Z"),
      entry("tomorrow", "2026-11-03T17:01:00Z"),
      entry("next-month", "2026-12-01T12:00:00Z"),
    ], { initialMonth: "2026-10" });
    expect(html).toContain("Upcoming agenda");
    expect(html).toContain("Today ·");
    expect(html).toContain("Tomorrow ·");
    expect(html).toContain("Post next-month");
    expect(html).not.toContain("Post past");
    expect(html).not.toContain('aria-label="Next period"');
    expect(html).toContain('draggable="false"');
  });
  it("restores Past from the URL prop, newest days first and times ascending within a day", () => {
    const html = render([
      entry("oldest", "2026-10-01T12:00:00Z"),
      entry("later", "2026-11-02T12:00:00Z"),
      entry("earlier", "2026-11-02T05:00:00Z"),
      entry("today", "2026-11-03T12:00:00Z"),
    ], { initialView: "agenda", initialPeriod: "past" });
    expect(html).toContain("Past agenda");
    expect(html).not.toContain("Post today");
    expect(html.indexOf("Post earlier")).toBeLessThan(html.indexOf("Post later"));
    expect(html.indexOf("Post later")).toBeLessThan(html.indexOf("Post oldest"));
  });
  it("sorts upcoming input chronologically and preserves brand/platform/status filters", () => {
    const html = render([
      entry("late", "2026-11-04T12:00:00Z"),
      entry("early", "2026-11-03T12:00:00Z"),
      entry("other-brand", "2026-11-03T12:00:00Z", { brand: "Cup" }),
      entry("facebook", "2026-11-03T12:00:00Z", { platform: "Facebook" }),
      entry("cancelled", "2026-11-03T12:00:00Z", { status: "cancelled" }),
    ], { initialBrand: "StadioMate", initialPlatform: "instagram" });
    expect(html.indexOf("Post early")).toBeLessThan(html.indexOf("Post late"));
    expect(html).not.toContain("Post other-brand");
    expect(html).not.toContain("Post facebook");
    expect(html).not.toContain("Post cancelled");
  });
  it("loads 14 populated days initially without losing later entries from the count", () => {
    const html = render(Array.from({ length: 16 }, (_, i) =>
      entry(`day-${String(i).padStart(2, "0")}`, new Date(Date.UTC(2026, 10, 3 + i, 12)).toISOString()),
    ));
    expect(html).toContain("16 posts in this view");
    expect(html).toContain("Post day-13");
    expect(html).not.toContain("Post day-14");
    expect(html).toContain("Show more upcoming days");
  });
  it("includes overdue planned work in Past attention but excludes published history", () => {
    const html = render([
      entry("overdue", "2026-11-02T12:00:00Z"),
      entry("published", "2026-11-02T12:00:00Z", { kind: "published", status: "published" }),
    ], { initialPeriod: "past", initialStatus: "attention" });
    expect(html).toContain("Post overdue");
    expect(html).not.toContain("Post published");
  });
  it("shows a useful empty state for each period", () => {
    expect(render([])).toContain("No posts planned from today onward");
    expect(render([], { initialPeriod: "past" })).toContain("No past posts match");
  });
});
