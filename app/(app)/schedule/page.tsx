import Link from "next/link";
import {
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
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
    week?: string;
    brand?: string;
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
  const rawView = resolvedSearchParams?.view ?? "month";
  const view = rawView === "calendar" ? "month" : rawView;
  const monthParam = resolvedSearchParams?.month ?? format(startOfMonth(new Date()), "yyyy-MM");
  const weekParam =
    resolvedSearchParams?.week ?? format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const brandFilter = resolvedSearchParams?.brand ?? "all";
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const parsedMonth = new Date(`${monthParam}-01T00:00:00`);
  const currentMonth = Number.isNaN(parsedMonth.getTime())
    ? startOfMonth(new Date())
    : startOfMonth(parsedMonth);
  const previousMonth = format(subMonths(currentMonth, 1), "yyyy-MM");
  const nextMonth = format(addMonths(currentMonth, 1), "yyyy-MM");
  const parsedWeek = new Date(`${weekParam}T00:00:00`);
  const currentWeek = Number.isNaN(parsedWeek.getTime())
    ? startOfWeek(new Date(), { weekStartsOn: 1 })
    : startOfWeek(parsedWeek, { weekStartsOn: 1 });
  const previousWeek = format(subWeeks(currentWeek, 1), "yyyy-MM-dd");
  const nextWeek = format(addWeeks(currentWeek, 1), "yyyy-MM-dd");

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

  const normalizedBrandFilter = brandFilter.toLowerCase();
  const allCampaigns = campaignsResponse.ok ? campaignsResponse.data : [];
  const brandScopedRows = rowsWithReadiness.filter(
    (row) =>
      normalizedBrandFilter === "all" || (row.brand ?? "").toLowerCase() === normalizedBrandFilter,
  );
  const campaigns = allCampaigns.filter((campaign) => {
    if (normalizedBrandFilter === "all") {
      return true;
    }

    return campaign.brand.some((brand) => brand.toLowerCase() === normalizedBrandFilter);
  });

  const availableBrands = Array.from(
    new Set(
      [
        ...rowsWithReadiness.map((row) => row.brand).filter(Boolean),
        ...allCampaigns.flatMap((campaign) => campaign.brand ?? []),
      ].map((brand) => brand?.trim()).filter(Boolean) as string[],
    ),
  ).sort((a, b) => a.localeCompare(b));

  const filteredRows = brandScopedRows.filter((row) => {
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
    all: brandScopedRows.length,
    ready: brandScopedRows.filter((row) => row.readiness.isReady).length,
    attention: brandScopedRows.filter((row) => !row.readiness.isReady).length,
    approved: brandScopedRows.filter((row) => row.approvedById).length,
    week: brandScopedRows.filter((row) => row.scheduledFor >= now && row.scheduledFor <= weekEnd)
      .length,
  };
  const scheduledCount = brandScopedRows.filter((row) => row.status === "scheduled").length;
  const activeCampaigns = campaigns.filter((campaign) => campaign.campaign_status === "active").length;

  function buildScheduleHref(next: {
    queue?: string;
    view?: string;
    month?: string;
    week?: string;
    brand?: string;
  }) {
    const params = new URLSearchParams();
    const resolvedQueue = next.queue ?? queue;
    const resolvedView = next.view ?? view;
    const resolvedMonth = next.month ?? monthParam;
    const resolvedWeek = next.week ?? weekParam;
    const resolvedBrand = next.brand ?? brandFilter;

    if (resolvedQueue !== "all") {
      params.set("queue", resolvedQueue);
    }

    if (resolvedView !== "month") {
      params.set("view", resolvedView);
    }

    params.set("month", resolvedMonth);
    params.set("week", resolvedWeek);

    if (resolvedBrand !== "all") {
      params.set("brand", resolvedBrand);
    }

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
              data-active={view === "month"}
              href={buildScheduleHref({ view: "month" })}
            >
              Month view
            </Link>
            <Link
              className="button button--secondary"
              data-active={view === "week"}
              href={buildScheduleHref({ view: "week" })}
            >
              Week view
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
          <div className="toolbar__group">
            <Link
              className="button button--secondary"
              data-active={brandFilter === "all"}
              href={buildScheduleHref({ brand: "all" })}
            >
              All brands
            </Link>
            {availableBrands.map((brand) => (
              <Link
                className="button button--secondary"
                data-active={brandFilter === brand}
                href={buildScheduleHref({ brand })}
                key={brand}
              >
                {brand}
              </Link>
            ))}
          </div>
        </div>

        {view === "month" || view === "week" ? (
          <>
            <div className="card card--padded">
              <div className="section-heading">
                <div>
                  <p className="kicker">{view === "week" ? "Weekly planning" : "Monthly planning"}</p>
                  <h3 style={{ marginTop: 0 }}>
                    {view === "week"
                      ? `${format(currentWeek, "d MMM")} – ${format(endOfWeek(currentWeek, { weekStartsOn: 1 }), "d MMM yyyy")}`
                      : format(currentMonth, "MMMM yyyy")}
                  </h3>
                </div>
                <div className="toolbar__group">
                  <Link
                    className="button button--secondary"
                    href={
                      view === "week"
                        ? buildScheduleHref({ week: previousWeek })
                        : buildScheduleHref({ month: previousMonth })
                    }
                  >
                    {view === "week" ? "Previous week" : "Previous month"}
                  </Link>
                  <Link
                    className="button button--secondary"
                    href={
                      view === "week"
                        ? buildScheduleHref({
                            week: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
                          })
                        : buildScheduleHref({
                            month: format(startOfMonth(new Date()), "yyyy-MM"),
                          })
                    }
                  >
                    {view === "week" ? "Current week" : "Current month"}
                  </Link>
                  <Link
                    className="button button--secondary"
                    href={
                      view === "week"
                        ? buildScheduleHref({ week: nextWeek })
                        : buildScheduleHref({ month: nextMonth })
                    }
                  >
                    {view === "week" ? "Next week" : "Next month"}
                  </Link>
                </div>
              </div>
            </div>

            <OperationsCalendar
              anchorDate={weekParam}
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
              viewMode={view === "week" ? "week" : "month"}
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
