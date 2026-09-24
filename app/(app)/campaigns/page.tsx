import Link from "next/link";
import { CampaignApiNotice } from "@/components/campaigns/campaign-api-notice";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { SummaryStats } from "@/components/ui/summary-stats";
import { StatusBadge } from "@/components/ui/status-badge";
import { safeListCampaigns } from "@/lib/campaigns/client";
import type { Campaign, CampaignStatus } from "@/lib/campaigns/types";
import { deleteCampaignAction } from "./actions";

export const dynamic = "force-dynamic";

const campaignWindows = ["current", "upcoming", "past"] as const;
type CampaignWindow = (typeof campaignWindows)[number];

type CampaignsPageProps = {
  searchParams: Promise<{ window?: string; status?: string }>;
};

function dateKey(value: string | null) {
  if (!value) return null;
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIME_ZONE ?? "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getCampaignWindow(campaign: Campaign, today: string): CampaignWindow {
  const start = dateKey(campaign.start_date);
  const end = dateKey(campaign.end_date);

  if (end && end < today) return "past";
  if (start && start > today) return "upcoming";
  return "current";
}

function formatDate(value: string | null) {
  const key = dateKey(value);
  if (!key) return null;
  const date = new Date(`${key}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateWindow(campaign: Campaign) {
  const start = formatDate(campaign.start_date);
  const end = formatDate(campaign.end_date);
  if (start && end) return `${start} to ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "Open dates";
}

function campaignHref(window: CampaignWindow, status?: string) {
  const params = new URLSearchParams({ window });
  if (status) params.set("status", status);
  return `/campaigns?${params.toString()}`;
}

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const params = await searchParams;
  const selectedWindow = campaignWindows.includes(params.window as CampaignWindow)
    ? (params.window as CampaignWindow)
    : "current";
  const selectedStatus = ["draft", "active", "completed", "cancelled"].includes(params.status ?? "")
    ? (params.status as CampaignStatus)
    : undefined;
  const response = await safeListCampaigns({ limit: 100 });
  const campaigns = response.ok ? response.data : [];
  const today = getTodayKey();
  const counts = Object.fromEntries(
    campaignWindows.map((window) => [
      window,
      campaigns.filter((campaign) => getCampaignWindow(campaign, today) === window).length,
    ]),
  ) as Record<CampaignWindow, number>;
  const visibleCampaigns = campaigns.filter((campaign) => (
    getCampaignWindow(campaign, today) === selectedWindow &&
    (!selectedStatus || campaign.campaign_status === selectedStatus)
  ));

  return (
    <section className="page-shell">
      <WorkspaceHeader
        stacked
        title="Campaigns"
        description="Manage campaign windows, briefs, brands, and publishing context from one compact workspace."
        actions={<Link className="button button--primary" href="/campaigns/new">New campaign</Link>}
      />

      <div className="stack">
        {!response.ok ? <CampaignApiNotice message={response.error ?? "Campaign API is unavailable."} /> : null}

        {response.ok ? (
          <SummaryStats
            items={[
              { label: "Current", value: counts.current, detail: "Running now or without a fixed date window" },
              { label: "Upcoming", value: counts.upcoming, detail: "Scheduled to begin after today" },
              { label: "Past", value: counts.past, detail: "Campaigns whose end date has passed" },
              { label: "Total", value: campaigns.length, detail: "Synced from the TechSport campaign service" },
            ]}
          />
        ) : null}

        {response.ok ? (
          <div className="plan-table-workspace">
            <nav aria-label="Campaign date windows" className="plan-status-tabs">
              {campaignWindows.map((window) => (
                <Link data-active={selectedWindow === window} href={campaignHref(window, selectedStatus)} key={window}>
                  {window}<span>{counts[window]}</span>
                </Link>
              ))}
            </nav>

            <div className="toolbar toolbar--compact plan-table-toolbar">
              <div className="toolbar__group">
                <strong>{visibleCampaigns.length} {selectedWindow} campaigns</strong>
                <span className="muted">Grouped by campaign dates</span>
              </div>
              <div className="toolbar__group">
                <details className="filter-disclosure">
                  <summary>{selectedStatus ? `Status: ${selectedStatus}` : "All statuses"}</summary>
                  <div className="plan-filter-popover quiet-panel">
                    <strong>Filter by status</strong>
                    <div className="toolbar__group">
                      <Link className="button button--secondary" href={campaignHref(selectedWindow)}>All</Link>
                      {(["active", "draft", "completed", "cancelled"] as CampaignStatus[]).map((status) => (
                        <Link className="button button--secondary" data-active={selectedStatus === status} href={campaignHref(selectedWindow, status)} key={status}>
                          {status}
                        </Link>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {visibleCampaigns.length === 0 ? (
              <div className="empty-state empty-state--quiet">
                <h3>No {selectedWindow} campaigns</h3>
                <p className="muted">Try another date window or clear the status filter.</p>
              </div>
            ) : (
              <div className="table-shell table-shell--flush">
                <table className="table campaigns-table">
                  <thead><tr><th>Campaign</th><th>Status</th><th>Brand</th><th>Type</th><th>Market</th><th>Dates</th><th>Updated</th><th aria-label="Actions" /></tr></thead>
                  <tbody>{visibleCampaigns.map((campaign) => {
                    const deleteCampaign = deleteCampaignAction.bind(null, campaign.campaign_id, campaign.campaign_name);
                    return <tr key={campaign.campaign_id}>
                      <td><Link href={`/campaigns/${campaign.campaign_id}`}><strong>{campaign.campaign_name}</strong></Link><div className="table-subtext">{campaign.campaign_description ?? "No campaign brief added"}</div></td>
                      <td><StatusBadge label={campaign.campaign_status} /></td>
                      <td>{campaign.brand.join(", ") || "Not set"}</td>
                      <td>{campaign.campaign_type ?? "Not set"}</td>
                      <td>{[campaign.region, campaign.country].filter(Boolean).join(", ") || "All markets"}</td>
                      <td>{formatDateWindow(campaign)}</td>
                      <td>{formatDate(campaign.updated_at) ?? "Unknown"}</td>
                      <td><div className="row-actions table-actions"><Link className="button button--secondary" href={`/campaigns/${campaign.campaign_id}`}>Open</Link><form action={deleteCampaign}><button className="button button--secondary" type="submit">Delete</button></form></div></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
