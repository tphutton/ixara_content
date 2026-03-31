import Link from "next/link";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { getCampaign } from "@/lib/campaigns/client";
import { prisma } from "@/lib/prisma";
import { deleteCampaignAction, updateCampaignAction } from "../actions";

export const dynamic = "force-dynamic";

type CampaignDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params;
  const [campaign, assets, linkedAsset] = await Promise.all([
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
  ]);
  const updateAction = updateCampaignAction.bind(null, id);
  const deleteAction = deleteCampaignAction.bind(null, id, campaign.campaign_name);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title={campaign.campaign_name}
        description="Review and update campaign configuration through the shared TechSport campaign service."
      />

      <div className="stack">
        <Link className="button button--secondary" href="/campaigns">
          Back to campaigns
        </Link>

        <div className="card card--padded">
          <CampaignForm
            action={updateAction}
            assets={assets}
            campaign={campaign}
            linkedAssetId={linkedAsset?.assetId ?? null}
          />
        </div>

        <form action={deleteAction}>
          <SubmitButton label="Delete campaign" pendingLabel="Deleting..." variant="secondary" />
        </form>
      </div>
    </section>
  );
}
