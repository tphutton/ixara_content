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
        description="Create a structured article with author metadata, feature image, and up to 8 managed content sections."
      />

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 0.8fr", alignItems: "start" }}>
        <div className="stack">
        <Link className="button button--secondary" href="/blogs">
          Back to blogs
        </Link>
        <div className="card card--padded">
          <BlogForm action={createBlogAction} assets={assets} brandProfiles={brandProfiles} />
        </div>
        </div>

        <BrandRuleGuide profiles={brandProfiles} />
      </div>
    </section>
  );
}
