import Link from "next/link";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Campaign } from "@/lib/campaigns/types";
import { StatusBadge } from "@/components/ui/status-badge";

type CalendarScheduleItem = {
  id: string;
  title: string;
  href: string;
  status: string;
  scheduledFor: Date;
  brand: string | null;
  channel: string | null;
};

type OperationsCalendarProps = {
  month: string;
  scheduleItems: CalendarScheduleItem[];
  campaigns: Campaign[];
  viewMode?: "month" | "week";
  anchorDate?: string;
};

type CalendarEvent = {
  key: string;
  kind: "schedule" | "campaign";
  title: string;
  href: string;
  status: string;
  meta: string;
  startsAt?: Date;
};

type WeekCampaignBar = {
  key: string;
  title: string;
  href: string;
  status: string;
  meta: string;
  startColumn: number;
  endColumn: number;
  row: number;
};

function parseMonth(month: string) {
  const parsed = parse(month, "yyyy-MM", new Date());

  if (Number.isNaN(parsed.getTime())) {
    return startOfMonth(new Date());
  }

  return startOfMonth(parsed);
}

function parseAnchorDate(value: string | undefined, fallbackMonth: string) {
  if (!value) {
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  }

  const parsed = parse(value, "yyyy-MM-dd", new Date());

  if (Number.isNaN(parsed.getTime())) {
    return startOfWeek(parseMonth(fallbackMonth), { weekStartsOn: 1 });
  }

  return startOfWeek(parsed, { weekStartsOn: 1 });
}

function occursWithinDay(date: Date, start: Date, end: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return start <= dayEnd && end >= dayStart;
}

function getCampaignEventsForDay(day: Date, campaigns: Campaign[]): CalendarEvent[] {
  return campaigns
    .filter((campaign) => {
      if (!campaign.start_date) {
        return false;
      }

      const start = new Date(campaign.start_date);
      const end = campaign.end_date ? new Date(campaign.end_date) : start;

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return false;
      }

      return occursWithinDay(day, start, end);
    })
    .map((campaign) => ({
      key: `campaign-${campaign.campaign_id}`,
      kind: "campaign" as const,
      title: campaign.campaign_name,
      href: `/campaigns/${campaign.campaign_id}`,
      status: campaign.campaign_status,
      meta:
        campaign.brand.join(", ") ||
        [campaign.country, campaign.region].filter(Boolean).join(" • ") ||
        "Campaign",
    }));
}

function getScheduleEventsForDay(day: Date, scheduleItems: CalendarScheduleItem[]): CalendarEvent[] {
  return scheduleItems
    .filter((item) => isSameDay(item.scheduledFor, day))
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
    .map((item) => ({
      key: `schedule-${item.id}`,
      kind: "schedule" as const,
      title: item.title,
      href: item.href,
      status: item.status,
      meta: [item.channel, item.brand].filter(Boolean).join(" • ") || "Scheduled item",
      startsAt: item.scheduledFor,
    }));
}

function buildWeekCampaignBars(
  weekStart: Date,
  campaigns: Campaign[],
): { bars: WeekCampaignBar[]; rowCount: number } {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const spans = campaigns
    .filter((campaign) => {
      if (!campaign.start_date) {
        return false;
      }

      const start = new Date(campaign.start_date);
      const end = campaign.end_date ? new Date(campaign.end_date) : start;

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return false;
      }

      return start <= weekEnd && end >= weekStart;
    })
    .map((campaign) => {
      const start = new Date(campaign.start_date as string);
      const end = campaign.end_date ? new Date(campaign.end_date) : start;
      const clippedStart = start < weekStart ? weekStart : start;
      const clippedEnd = end > weekEnd ? weekEnd : end;
      const startColumn = Math.max(
        1,
        Math.min(7, Math.floor((clippedStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1),
      );
      const endColumn = Math.max(
        startColumn + 1,
        Math.min(
          8,
          Math.floor((clippedEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 2,
        ),
      );

      return {
        key: `campaign-${campaign.campaign_id}`,
        title: campaign.campaign_name,
        href: `/campaigns/${campaign.campaign_id}`,
        status: campaign.campaign_status,
        meta:
          campaign.brand.join(", ") ||
          [campaign.country, campaign.region].filter(Boolean).join(" • ") ||
          "Campaign",
        startColumn,
        endColumn,
      };
    })
    .sort((a, b) => {
      if (a.startColumn !== b.startColumn) {
        return a.startColumn - b.startColumn;
      }

      return b.endColumn - a.endColumn;
    });

  const rowEndByIndex: number[] = [];
  const bars: WeekCampaignBar[] = spans.map((span) => {
    let row = 0;

    while ((rowEndByIndex[row] ?? 0) > span.startColumn) {
      row += 1;
    }

    rowEndByIndex[row] = span.endColumn;

    return {
      ...span,
      row,
    };
  });

  return {
    bars,
    rowCount: Math.max(1, rowEndByIndex.length),
  };
}

function renderMonthView(currentMonth: Date, scheduleItems: CalendarScheduleItem[], campaigns: Campaign[]) {
  const calendarStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="calendar-scroll">
      <div className="calendar-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div className="calendar-grid__weekday" key={day}>
            {day}
          </div>
        ))}

        {days.map((day) => {
          const dayCampaignEvents = getCampaignEventsForDay(day, campaigns);
          const dayScheduleEvents = getScheduleEventsForDay(day, scheduleItems);
          const events = [...dayCampaignEvents, ...dayScheduleEvents];
          const visibleEvents = events.slice(0, 4);
          const hiddenCount = Math.max(0, events.length - visibleEvents.length);

          return (
            <div
              className="calendar-day"
              data-current-month={isSameMonth(day, currentMonth)}
              data-today={isToday(day)}
              key={day.toISOString()}
            >
              <div className="calendar-day__header">
                <span>{format(day, "d")}</span>
                {events.length > 0 ? (
                  <span className="calendar-day__count">{events.length}</span>
                ) : null}
              </div>

              <div className="calendar-day__events">
                {visibleEvents.map((event) => (
                  <Link className="calendar-event" data-kind={event.kind} href={event.href} key={event.key}>
                    <div className="calendar-event__top">
                      <strong>{event.title}</strong>
                      <StatusBadge label={event.status} />
                    </div>
                    <span className="muted">
                      {event.kind === "schedule" && event.startsAt
                        ? `${format(event.startsAt, "HH:mm")} • ${event.meta}`
                        : event.meta}
                    </span>
                  </Link>
                ))}

                {hiddenCount > 0 ? <div className="calendar-day__more">+{hiddenCount} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderWeekView(weekStart: Date, scheduleItems: CalendarScheduleItem[], campaigns: Campaign[]) {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const campaignBars = buildWeekCampaignBars(weekStart, campaigns);

  return (
    <div className="week-scroll">
      <div className="week-shell">
        <section className="week-board">
          <div className="week-board__header">
            <div>
              <p className="kicker">All-day campaigns</p>
              <h4>Live campaign window</h4>
            </div>
            <span className="inline-chip">{campaignBars.bars.length} campaigns</span>
          </div>

          <div className="week-board__days">
            {days.map((day) => (
              <div className="week-board__day" data-today={isToday(day)} key={day.toISOString()}>
                <span>{format(day, "EEE")}</span>
                <strong>{format(day, "d MMM")}</strong>
              </div>
            ))}
          </div>

          <div
            className="week-campaign-board"
            style={{ gridTemplateRows: `repeat(${campaignBars.rowCount}, minmax(74px, auto))` }}
          >
            {campaignBars.bars.length === 0 ? (
              <div className="week-empty-slot week-empty-slot--board">No campaigns this week</div>
            ) : (
              campaignBars.bars.map((bar) => (
                <Link
                  className="week-campaign-bar"
                  href={bar.href}
                  key={bar.key}
                  style={{
                    gridColumn: `${bar.startColumn} / ${bar.endColumn}`,
                    gridRow: `${bar.row + 1}`,
                  }}
                >
                  <div className="week-event__top">
                    <strong>{bar.title}</strong>
                    <StatusBadge label={bar.status} />
                  </div>
                  <div className="week-event__bottom">
                    <span className="muted">{bar.meta}</span>
                    <span className="week-campaign-bar__duration">
                      {bar.endColumn - bar.startColumn} day{bar.endColumn - bar.startColumn === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="week-posts">
          <div className="week-board__header">
            <div>
              <p className="kicker">Timed posts</p>
              <h4>Scheduled content by day</h4>
            </div>
            <span className="inline-chip">{scheduleItems.length} posts</span>
          </div>

          <div className="week-view">
            {days.map((day) => {
              const dayScheduleEvents = getScheduleEventsForDay(day, scheduleItems);

              return (
                <section className="week-day-card" data-today={isToday(day)} key={day.toISOString()}>
                  <div className="week-day-card__header">
                    <div>
                      <p className="kicker">{format(day, "EEE")}</p>
                      <h3>{format(day, "d MMM")}</h3>
                    </div>
                    <span className="inline-chip">{dayScheduleEvents.length} posts</span>
                  </div>

                  {dayScheduleEvents.length === 0 ? (
                    <div className="week-empty-slot">No scheduled posts</div>
                  ) : (
                    <div className="week-day-card__lane">
                      {dayScheduleEvents.map((event) => (
                        <Link className="week-event week-event--schedule" href={event.href} key={event.key}>
                          <div className="week-event__top">
                            <div className="week-event__time">
                              {event.startsAt ? format(event.startsAt, "HH:mm") : "—"}
                            </div>
                            <strong>{event.title}</strong>
                          </div>
                          <div className="week-event__bottom">
                            <span className="muted">{event.meta}</span>
                            <StatusBadge label={event.status} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export function OperationsCalendar({
  month,
  scheduleItems,
  campaigns,
  viewMode = "month",
  anchorDate,
}: OperationsCalendarProps) {
  const currentMonth = parseMonth(month);
  const weekStart = parseAnchorDate(anchorDate, month);

  return (
    <section className="card card--padded">
      <div className="calendar-header">
        <div>
          <p className="kicker">Planning calendar</p>
          <h3 style={{ marginTop: 0 }}>
            {viewMode === "week"
              ? `${format(weekStart, "d MMM")} – ${format(endOfWeek(weekStart, { weekStartsOn: 1 }), "d MMM yyyy")}`
              : format(currentMonth, "MMMM yyyy")}
          </h3>
        </div>
        <div className="calendar-legend">
          <span className="inline-chip">All-day campaigns</span>
          <span className="inline-chip">Timed posts</span>
        </div>
      </div>

      {viewMode === "week"
        ? renderWeekView(weekStart, scheduleItems, campaigns)
        : renderMonthView(currentMonth, scheduleItems, campaigns)}
    </section>
  );
}
