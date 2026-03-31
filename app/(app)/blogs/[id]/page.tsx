import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogForm } from "@/components/blogs/blog-form";
import { BlogPreview } from "@/components/blogs/blog-preview";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { BrandRuleGuide } from "@/components/settings/brand-rule-guide";
import { prisma } from "@/lib/prisma";
import { deleteBlogAction, updateBlogAction } from "../actions";

export const dynamic = "force-dynamic";

type BlogDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { id } = await params;
  const [blog, assets, brandProfiles] = await Promise.all([
    prisma.blog.findUnique({ where: { id } }),
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

  if (!blog) {
    notFound();
  }

  const updateAction = updateBlogAction.bind(null, id);
  const deleteAction = deleteBlogAction.bind(null, id);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title={blog.title}
        description="Manage article metadata and the structured 8-block editorial body."
      />

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 0.8fr 0.8fr", alignItems: "start" }}>
        <div className="stack">
          <Link className="button button--secondary" href="/blogs">
            Back to blogs
          </Link>
          <div className="card card--padded">
            <BlogForm action={updateAction} assets={assets} blog={blog} brandProfiles={brandProfiles} />
          </div>
          <form action={deleteAction}>
            <SubmitButton label="Delete blog" pendingLabel="Deleting..." variant="secondary" />
          </form>
        </div>

        <BlogPreview blog={blog} />
        <BrandRuleGuide profiles={brandProfiles} />
      </div>
    </section>
  );
}
