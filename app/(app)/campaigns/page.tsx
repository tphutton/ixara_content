import { CampaignApiNotice } from "@/components/campaigns/campaign-api-notice";
import Link from "next/link";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
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

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Campaigns"
        description="View and manage promotional campaigns from the main TechSport data system."
      />

      <div className="stack">
        {!response.ok ? <CampaignApiNotice message={response.error ?? "Campaign API is unavailable."} /> : null}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="button button--secondary" href="/campaigns">
              All
            </Link>
            <Link className="button button--secondary" href="/campaigns?status=active">
              Active
            </Link>
            <Link className="button button--secondary" href="/campaigns?status=draft">
              Draft
            </Link>
          </div>

          <Link className="button button--primary" href="/campaigns/new">
            Create campaign
          </Link>
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
