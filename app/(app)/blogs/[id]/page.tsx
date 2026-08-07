import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogForm } from "@/components/blogs/blog-form";
import { BlogDetailOverview } from "@/components/blogs/blog-detail-overview";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { QualityReviewPanel } from "@/components/quality/quality-review-panel";
import { BrandRuleGuide } from "@/components/settings/brand-rule-guide";
import { prisma } from "@/lib/prisma";
import { reviewBlogQualityAction } from "../../quality/actions";
import { deleteBlogAction, updateBlogAction } from "../actions";

export const dynamic = "force-dynamic";

type BlogDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ edit?: string }>;
};

export default async function BlogDetailPage({
  params,
  searchParams,
}: BlogDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isEditing = resolvedSearchParams?.edit === "1";

  const [blog, assets, brandProfiles] = await Promise.all([
    prisma.blog.findUnique({
      where: { id },
      include: {
        qualityReviews: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    }),
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
  const reviewAction = reviewBlogQualityAction.bind(null, id);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title={blog.title}
        description="Review the article as an editorial record first, then open the editor only when you need to update it."
      />

      <div className="toolbar">
        <div className="toolbar__group">
          <Link className="button button--secondary" href="/blogs">
            Back to blogs
          </Link>
          <Link className="button button--primary" href={`/blogs/${id}?edit=1`}>
            Update article
          </Link>
        </div>
      </div>

      <BlogDetailOverview blog={blog} />

      <QualityReviewPanel action={reviewAction} reviews={blog.qualityReviews} />

      <div className="card card--padded">
        <div className="section-heading">
          <div>
            <p className="kicker">Brand guidance</p>
            <h3>Editorial guardrails</h3>
          </div>
          <span className="inline-chip">{brandProfiles.length} profiles loaded</span>
        </div>
        <BrandRuleGuide profiles={brandProfiles} />
      </div>

      {isEditing ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close editor" href={`/blogs/${id}`} />
          </div>

          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Editing</p>
                <h3>{blog.title}</h3>
                <p className="muted">Structured article editor with grouped metadata and section blocks.</p>
              </div>
              <Link className="button button--secondary" href={`/blogs/${id}`}>
                Close
              </Link>
            </div>

            <div className="editor-overlay__content">
              <BlogForm action={updateAction} assets={assets} blog={blog} brandProfiles={brandProfiles} />
            </div>

            <div className="editor-overlay__footer">
              <form action={deleteAction}>
                <SubmitButton label="Delete blog" pendingLabel="Deleting..." variant="secondary" />
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
