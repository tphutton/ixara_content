import Link from "next/link";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { CampaignApiNotice } from "@/components/campaigns/campaign-api-notice";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { OperationsCalendar } from "@/components/schedule/operations-calendar";
import { prisma } from "@/lib/prisma";
import { safeListCampaigns } from "@/lib/campaigns/client";
import { getScheduleReadiness } from "@/lib/schedule/readiness";
import { SummaryStats } from "@/components/ui/summary-stats";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

type SchedulePageProps = {
  searchParams?: Promise<{
    queue?: string;
    view?: string;
    month?: string;
  }>;
};

const queueOptions = [
  { key: "all", label: "All entries" },
  { key: "ready", label: "Ready queue" },
  { key: "attention", label: "Needs attention" },
  { key: "approved", label: "Approved only" },
  { key: "week", label: "This week" },
] as const;

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const queue = resolvedSearchParams?.queue ?? "all";
  const view = resolvedSearchParams?.view ?? "calendar";
  const monthParam = resolvedSearchParams?.month ?? format(startOfMonth(new Date()), "yyyy-MM");
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const parsedMonth = new Date(`${monthParam}-01T00:00:00`);
  const currentMonth = Number.isNaN(parsedMonth.getTime())
    ? startOfMonth(new Date())
    : startOfMonth(parsedMonth);
  const previousMonth = format(subMonths(currentMonth, 1), "yyyy-MM");
  const nextMonth = format(addMonths(currentMonth, 1), "yyyy-MM");

  const [scheduleRows, campaignsResponse] = await Promise.all([
    prisma.contentSchedule.findMany({
      include: {
        blog: {
          select: {
            title: true,
            brand: true,
            websites: true,
            featureAssetId: true,
            featureImage: true,
          },
        },
        content: {
          select: {
            title: true,
            brand: true,
            tone: true,
            targetAudience: true,
            primaryAssetId: true,
            assetImage: true,
          },
        },
        approvedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { scheduledFor: "asc" },
    }),
    safeListCampaigns({ limit: 100 }),
  ]);

  const rowsWithReadiness = scheduleRows.map((row) => ({
    ...row,
    readiness: getScheduleReadiness({
      channel: row.channel,
      platformAccount: row.platformAccount,
      brand: row.brand,
      approvedById: row.approvedById,
      content: row.content,
      blog: row.blog,
    }),
  }));

  const filteredRows = rowsWithReadiness.filter((row) => {
    if (queue === "ready") {
      return row.readiness.isReady;
    }

    if (queue === "attention") {
      return !row.readiness.isReady;
    }

    if (queue === "approved") {
      return Boolean(row.approvedById);
    }

    if (queue === "week") {
      return row.scheduledFor >= now && row.scheduledFor <= weekEnd;
    }

    return true;
  });

  const queueSummary = {
    all: rowsWithReadiness.length,
    ready: rowsWithReadiness.filter((row) => row.readiness.isReady).length,
    attention: rowsWithReadiness.filter((row) => !row.readiness.isReady).length,
    approved: rowsWithReadiness.filter((row) => row.approvedById).length,
    week: rowsWithReadiness.filter((row) => row.scheduledFor >= now && row.scheduledFor <= weekEnd)
      .length,
  };
  const scheduledCount = rowsWithReadiness.filter((row) => row.status === "scheduled").length;
  const campaigns = campaignsResponse.ok ? campaignsResponse.data : [];
  const activeCampaigns = campaigns.filter((campaign) => campaign.campaign_status === "active").length;

  function buildScheduleHref(next: { queue?: string; view?: string; month?: string }) {
    const params = new URLSearchParams();
    const resolvedQueue = next.queue ?? queue;
    const resolvedView = next.view ?? view;
    const resolvedMonth = next.month ?? monthParam;

    if (resolvedQueue !== "all") {
      params.set("queue", resolvedQueue);
    }

    if (resolvedView !== "calendar") {
      params.set("view", resolvedView);
    }

    params.set("month", resolvedMonth);

    return `/schedule?${params.toString()}`;
  }

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Schedule"
        description="Publishing operations for content and blog records across channels, brands, and regions."
      />

      <div className="stack">
        <SummaryStats
          items={[
            {
              label: "All entries",
              value: queueSummary.all,
              detail: "Combined content and blog publishing operations",
            },
            {
              label: "Ready queue",
              value: queueSummary.ready,
              detail: "Entries prepared for downstream automation or publishing",
            },
            {
              label: "Scheduled",
              value: scheduledCount,
              detail: "Entries already committed to a date and workflow",
            },
            {
              label: "Active campaigns",
              value: activeCampaigns,
              detail: campaignsResponse.ok
                ? "Shown alongside schedule items in the planning calendar"
                : "Campaign API unavailable",
            },
          ]}
        />

        {!campaignsResponse.ok ? (
          <CampaignApiNotice message={campaignsResponse.error ?? "Campaign API is unavailable."} />
        ) : null}

        <div className="toolbar">
          <div className="toolbar__group">
            <Link className="button button--primary" href="/schedule/new">
              Create schedule entry
            </Link>
          </div>
          <div className="toolbar__group">
            <Link
              className="button button--secondary"
              data-active={view === "calendar"}
              href={buildScheduleHref({ view: "calendar" })}
            >
              Calendar view
            </Link>
            <Link
              className="button button--secondary"
              data-active={view === "table"}
              href={buildScheduleHref({ view: "table" })}
            >
              Table view
            </Link>
          </div>
          <div className="toolbar__group">
            {queueOptions.map((option) => (
              <Link
                className="button button--secondary"
                data-active={queue === option.key}
                href={buildScheduleHref({ queue: option.key })}
                key={option.key}
              >
                {option.label} ({queueSummary[option.key]})
              </Link>
            ))}
          </div>
        </div>

        {view === "calendar" ? (
          <>
            <div className="card card--padded">
              <div className="section-heading">
                <div>
                  <p className="kicker">Monthly planning</p>
                  <h3 style={{ marginTop: 0 }}>{format(currentMonth, "MMMM yyyy")}</h3>
                </div>
                <div className="toolbar__group">
                  <Link
                    className="button button--secondary"
                    href={buildScheduleHref({ month: previousMonth })}
                  >
                    Previous month
                  </Link>
                  <Link
                    className="button button--secondary"
                    href={buildScheduleHref({
                      month: format(startOfMonth(new Date()), "yyyy-MM"),
                    })}
                  >
                    Current month
                  </Link>
                  <Link
                    className="button button--secondary"
                    href={buildScheduleHref({ month: nextMonth })}
                  >
                    Next month
                  </Link>
                </div>
              </div>
            </div>

            <OperationsCalendar
              campaigns={campaigns}
              month={monthParam}
              scheduleItems={filteredRows.map((row) => ({
                id: row.id,
                title: row.content?.title ?? row.blog?.title ?? "Untitled link",
                href: `/schedule/${row.id}`,
                status: row.status,
                scheduledFor: row.scheduledFor,
                brand: row.brand,
                channel: row.channel,
              }))}
            />
          </>
        ) : filteredRows.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No schedule entries in this queue</h3>
            <p className="muted">
              Adjust the queue filter or create a new schedule entry to populate this workflow
              view.
            </p>
          </div>
        ) : (
          <div className="card table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Channel</th>
                  <th>Scheduled For</th>
                  <th>Brand</th>
                  <th>Approval</th>
                  <th>Readiness</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/schedule/${row.id}`}>{row.content?.title ?? row.blog?.title ?? "Untitled link"}</Link>
                    </td>
                    <td>{row.channel ?? "—"}</td>
                    <td>{new Date(row.scheduledFor).toLocaleString()}</td>
                    <td>{row.brand ?? "—"}</td>
                    <td>
                      {row.approvedBy
                        ? row.approvedBy.fullName ?? row.approvedBy.email
                        : "Unapproved"}
                    </td>
                    <td>
                      <StatusBadge label={row.readiness.isReady ? "ready" : "warning"} />
                    </td>
                    <td>
                      <StatusBadge label={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
