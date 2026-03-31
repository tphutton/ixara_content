import Link from "next/link";
import { ContentForm } from "@/components/content/content-form";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { BrandRuleGuide } from "@/components/settings/brand-rule-guide";
import { prisma } from "@/lib/prisma";
import { createContentAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewContentPage() {
  const [assets, brandProfiles] = await Promise.all([
    prisma.asset.findMany({
      select: { id: true, title: true },
      orderBy: { syncedAt: "desc" },
      take: 100,
    }),
    prisma.brandProfile.findMany({
      select: {
        id: true,
        brandName: true,
        defaultTone: true,
        targetAudience: true,
        preferredWebsites: true,
        sports: true,
        regions: true,
        countries: true,
        bannedPhrases: true,
        preferredCTAs: true,
      },
      orderBy: { brandName: "asc" },
    }),
  ]);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="New Content"
        description="Create a short-form content record with operational metadata, assets, and publishing context."
      />

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 0.8fr", alignItems: "start" }}>
        <div className="stack">
        <Link className="button button--secondary" href="/content">
          Back to content
        </Link>
        <div className="card card--padded">
          <ContentForm action={createContentAction} assets={assets} brandProfiles={brandProfiles} />
        </div>
        </div>

        <BrandRuleGuide profiles={brandProfiles} />
      </div>
    </section>
  );
}
