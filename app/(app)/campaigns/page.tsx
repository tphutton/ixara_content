import { CampaignApiNotice } from "@/components/campaigns/campaign-api-notice";
import Link from "next/link";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { SummaryStats } from "@/components/ui/summary-stats";
import { StatusBadge } from "@/components/ui/status-badge";
import { safeListCampaigns } from "@/lib/campaigns/client";

export const dynamic = "force-dynamic";

type CampaignsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const { status } = await searchParams;
  const response = await safeListCampaigns({
    status: status as never,
    limit: 100,
  });
  const campaigns = response.ok ? response.data : [];
  const activeCount = campaigns.filter((campaign) => campaign.campaign_status === "active").length;
  const draftCount = campaigns.filter((campaign) => campaign.campaign_status === "draft").length;
  const upcomingCount = campaigns.filter((campaign) => {
    if (!campaign.start_date) {
      return false;
    }

    const startDate = new Date(campaign.start_date);
    return !Number.isNaN(startDate.getTime()) && startDate >= new Date();
  }).length;

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Campaigns"
        description="View and manage promotional campaigns from the main TechSport data system."
      />

      <div className="stack">
        {!response.ok ? <CampaignApiNotice message={response.error ?? "Campaign API is unavailable."} /> : null}

        {response.ok ? (
          <SummaryStats
            items={[
              {
                label: "Total campaigns",
                value: campaigns.length,
                detail: "Synced live from the main TechSport campaign service",
              },
              {
                label: "Active",
                value: activeCount,
                detail: "Campaigns currently running or visible to operators",
              },
              {
                label: "Draft",
                value: draftCount,
                detail: "Campaigns still being shaped before launch",
              },
              {
                label: "Upcoming",
                value: upcomingCount,
                detail: "Future campaigns with a known start date",
              },
            ]}
          />
        ) : null}

        <div className="toolbar">
          <div className="toolbar__group">
            <Link className="button button--secondary" href="/campaigns">
              All
            </Link>
            <Link
              className="button button--secondary"
              data-active={status === "active"}
              href="/campaigns?status=active"
            >
              Active
            </Link>
            <Link
              className="button button--secondary"
              data-active={status === "draft"}
              href="/campaigns?status=draft"
            >
              Draft
            </Link>
          </div>

          <div className="toolbar__group">
            <Link className="button button--primary" href="/campaigns/new">
              Create campaign
            </Link>
          </div>
        </div>

        {response.ok && response.data.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No campaigns found</h3>
            <p className="muted">Create a new campaign or clear the active filter to see more results.</p>
          </div>
        ) : response.ok ? (
          <div className="card table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Brand</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Country</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {response.data.map((campaign) => (
                  <tr key={campaign.campaign_id}>
                    <td>
                      <Link href={`/campaigns/${campaign.campaign_id}`}>{campaign.campaign_name}</Link>
                    </td>
                    <td>{campaign.brand.join(", ") || "—"}</td>
                    <td>{campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : "—"}</td>
                    <td>{campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : "—"}</td>
                    <td>{campaign.country ?? "—"}</td>
                    <td>{campaign.campaign_type ?? "—"}</td>
                    <td>
                      <StatusBadge label={campaign.campaign_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
