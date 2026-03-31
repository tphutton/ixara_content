import Link from "next/link";
import { BlogForm } from "@/components/blogs/blog-form";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { BrandRuleGuide } from "@/components/settings/brand-rule-guide";
import { prisma } from "@/lib/prisma";
import { createBlogAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewBlogPage() {
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
        title="New Blog"
        description="Create a structured article with grouped metadata, curated website destinations, and a cleaner 8-section editorial workflow."
      />

      <div className="grid" style={{ gridTemplateColumns: "1.15fr 0.85fr", alignItems: "start" }}>
        <div className="stack">
          <div className="toolbar">
            <div className="toolbar__group">
              <Link className="button button--secondary" href="/blogs">
                Back to blogs
              </Link>
            </div>
            <span className="inline-chip">Draft setup</span>
          </div>

          <BlogForm action={createBlogAction} assets={assets} brandProfiles={brandProfiles} />
        </div>

        <BrandRuleGuide profiles={brandProfiles} />
      </div>
    </section>
  );
}
