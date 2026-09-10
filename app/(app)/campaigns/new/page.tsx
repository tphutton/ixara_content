import Link from "next/link";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { prisma } from "@/lib/prisma";
import { createCampaignAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const [assets, brandProfiles] = await Promise.all([
    prisma.asset.findMany({
      select: { id: true, title: true },
      orderBy: { syncedAt: "desc" },
      take: 100,
    }),
    prisma.brandProfile.findMany({
      select: { id: true, brandName: true },
      orderBy: { brandName: "asc" },
    }),
  ]);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="New Campaign"
        description="Create or launch a promotional campaign from the central TechSport campaigns API."
      />

      <div className="stack">
        <Link className="button button--secondary" href="/campaigns">
          Back to campaigns
        </Link>

        <div className="card card--padded">
          <CampaignForm action={createCampaignAction} assets={assets} brandProfiles={brandProfiles} />
        </div>
      </div>
    </section>
  );
}
