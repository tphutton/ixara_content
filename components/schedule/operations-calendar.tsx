import Link from "next/link";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
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
};

type CalendarEvent = {
  key: string;
  kind: "schedule" | "campaign";
  title: string;
  href: string;
  status: string;
  meta: string;
};

function parseMonth(month: string) {
  const parsed = parse(month, "yyyy-MM", new Date());

  if (Number.isNaN(parsed.getTime())) {
    return startOfMonth(new Date());
  }

  return startOfMonth(parsed);
}

function occursWithinDay(date: Date, start: Date, end: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return start <= dayEnd && end >= dayStart;
}

export function OperationsCalendar({
  month,
  scheduleItems,
  campaigns,
}: OperationsCalendarProps) {
  const currentMonth = parseMonth(month);
  const calendarStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <section className="card card--padded">
      <div className="calendar-header">
        <div>
          <p className="kicker">Planning calendar</p>
          <h3 style={{ marginTop: 0 }}>{format(currentMonth, "MMMM yyyy")}</h3>
        </div>
        <div className="calendar-legend">
          <span className="inline-chip">Schedule entries</span>
          <span className="inline-chip">Campaigns</span>
        </div>
      </div>

      <div className="calendar-scroll">
        <div className="calendar-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div className="calendar-grid__weekday" key={day}>
              {day}
            </div>
          ))}

          {days.map((day) => {
            const dayScheduleEvents: CalendarEvent[] = scheduleItems
              .filter((item) => item.scheduledFor.toDateString() === day.toDateString())
              .map((item) => ({
                key: `schedule-${item.id}`,
                kind: "schedule" as const,
                title: item.title,
                href: item.href,
                status: item.status,
                meta: [item.channel, item.brand].filter(Boolean).join(" • ") || "Scheduled item",
              }));

            const dayCampaignEvents: CalendarEvent[] = campaigns
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

            const events = [...dayScheduleEvents, ...dayCampaignEvents];
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
                    <Link
                      className="calendar-event"
                      data-kind={event.kind}
                      href={event.href}
                      key={event.key}
                    >
                      <div className="calendar-event__top">
                        <strong>{event.title}</strong>
                        <StatusBadge label={event.status} />
                      </div>
                      <span className="muted">{event.meta}</span>
                    </Link>
                  ))}

                  {hiddenCount > 0 ? (
                    <div className="calendar-day__more">+{hiddenCount} more</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
