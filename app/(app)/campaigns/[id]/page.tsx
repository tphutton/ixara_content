import Link from "next/link";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCampaign } from "@/lib/campaigns/client";
import { prisma } from "@/lib/prisma";
import { deleteCampaignAction, updateCampaignAction } from "../actions";

export const dynamic = "force-dynamic";

type CampaignDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default async function CampaignDetailPage({ params, searchParams }: CampaignDetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [campaign, assets, linkedAsset, brandProfiles] = await Promise.all([
    getCampaign(id),
    prisma.asset.findMany({
      select: { id: true, title: true },
      orderBy: { syncedAt: "desc" },
      take: 100,
    }),
    prisma.campaignAsset.findFirst({
      where: { campaignId: id, role: "primary" },
      select: { assetId: true },
    }),
    prisma.brandProfile.findMany({
      select: { id: true, brandName: true },
      orderBy: { brandName: "asc" },
    }),
  ]);
  const updateAction = updateCampaignAction.bind(null, id);
  const deleteAction = deleteCampaignAction.bind(null, id, campaign.campaign_name);
  const isEditing = query.edit === "1";

  return (
    <section className="page-shell">
      <WorkspaceHeader
        stacked
        title={campaign.campaign_name}
        description="Review the campaign brief and publishing context, then open the editor only when changes are needed."
        actions={
          <>
            <Link className="button button--secondary" href="/campaigns">Back</Link>
            <Link className="button button--primary" href={`/campaigns/${id}?edit=1`}>Edit campaign</Link>
          </>
        }
      />

      <div className="stack">
        <div className="plan-summary-bar">
          <StatusBadge label={campaign.campaign_status} />
          <span><strong>{campaign.brand.join(", ") || "No brand"}</strong></span>
          <span>{campaign.campaign_type ?? "No campaign type"}</span>
          <span>{formatDate(campaign.start_date)} to {formatDate(campaign.end_date)}</span>
        </div>

        <div className="campaign-detail-layout">
          <section className="quiet-panel campaign-brief-panel">
            <div className="section-heading"><div><p className="kicker">Campaign brief</p><h3>Purpose and direction</h3></div></div>
            <p>{campaign.campaign_description ?? "No campaign description has been added yet."}</p>
          </section>

          <section className="quiet-panel">
            <div className="section-heading"><div><p className="kicker">Configuration</p><h3>Campaign details</h3></div></div>
            <dl className="campaign-detail-list">
              <div><dt>Start date</dt><dd>{formatDate(campaign.start_date)}</dd></div>
              <div><dt>End date</dt><dd>{formatDate(campaign.end_date)}</dd></div>
              <div><dt>Region</dt><dd>{campaign.region ?? "All regions"}</dd></div>
              <div><dt>Country</dt><dd>{campaign.country ?? "All countries"}</dd></div>
              <div><dt>Category</dt><dd>{campaign.category ?? "Not set"}</dd></div>
              <div><dt>Partner ID</dt><dd>{campaign.partner_id ?? "Not set"}</dd></div>
              <div><dt>Featured image</dt><dd>{campaign.featured_image_link ? <a href={campaign.featured_image_link} rel="noreferrer" target="_blank">Open image</a> : "Not set"}</dd></div>
              <div><dt>Updated</dt><dd>{formatDate(campaign.updated_at)}</dd></div>
            </dl>
          </section>
        </div>

        <div className="toolbar toolbar--compact">
          <div className="toolbar__group"><span className="muted">Campaign ID: {campaign.campaign_id}</span></div>
          <div className="toolbar__group">
            <Link className="button button--primary" href={`/campaigns/${id}?edit=1`}>Edit</Link>
            <form action={deleteAction}><button className="button button--secondary" type="submit">Delete</button></form>
          </div>
        </div>
      </div>

      {isEditing ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop"><Link aria-label="Close campaign editor" href={`/campaigns/${id}`} /></div>
          <section className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div><p className="kicker">Campaign editor</p><h3>{campaign.campaign_name}</h3></div>
              <Link className="button button--secondary" href={`/campaigns/${id}`}>Close</Link>
            </div>
            <div className="editor-overlay__content">
              <CampaignForm
                action={updateAction}
                assets={assets}
                brandProfiles={brandProfiles}
                campaign={campaign}
                linkedAssetId={linkedAsset?.assetId ?? null}
              />
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
