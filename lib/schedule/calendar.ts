/** Calendar dates are editorial dates in Bangkok, independent of host/browser TZ. */
export const CALENDAR_TIMEZONE = "Asia/Bangkok";
export function calendarDay(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function calendarTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CALENDAR_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function safeMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
export type CalendarEntry = {
  id: string;
  kind: "schedule" | "published";
  title: string;
  date: string;
  status: string;
  brand: string;
  platform: string;
  account: string;
  caption: string;
  campaign: string | null;
  contentId: string | null;
  contentTitle: string | null;
  scheduleId: string | null;
  mediaUrl: string | null;
  thumbnail: string | null;
  externalUrl: string | null;
  metrics: Record<string, number | null> | null;
  syncedAt: string | null;
  notes: string | null;
};
/** A linked publication replaces its planned card; an unmatched import stays visible. */
export function combineCalendarEntries(
  planned: CalendarEntry[],
  published: CalendarEntry[],
) {
  const linked = new Set(published.map((p) => p.scheduleId).filter(Boolean));
  return [...planned.filter((p) => !linked.has(p.id)), ...published].sort(
    (a, b) => a.date.localeCompare(b.date),
  );
}
