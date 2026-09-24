import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialApprovalTargetType } from "@prisma/client";
import { EditorialApprovalPanel } from "@/components/approvals/editorial-approval-panel";
import { BlogForm } from "@/components/blogs/blog-form";
import { BlogDetailOverview } from "@/components/blogs/blog-detail-overview";
import { ProductionFlowPanel } from "@/components/content/production-flow-panel";
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
        schedules: { select: { id: true, scheduledFor: true, status: true }, orderBy: { scheduledFor: "asc" } },
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
  const latestQualityReview = blog.qualityReviews[0] ?? null;

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

      <div className="dashboard-command-grid">
        <div className="stack">
          <BlogDetailOverview blog={blog} />
        </div>

        <div className="stack">
          <EditorialApprovalPanel path={`/blogs/${id}`} targetId={blog.id} targetType={EditorialApprovalTargetType.blog} />
          <ProductionFlowPanel
            kind="blog"
            recordId={blog.id}
            status={blog.status}
            hasBody={Boolean(blog.text1 || blog.text2 || blog.text3)}
            hasBrand={Boolean(blog.brand)}
            hasAsset={Boolean(blog.featureAssetId || blog.featureImage || blog.image1)}
            latestQualityScore={latestQualityReview?.overallScore}
            scheduleCount={blog.schedules.length}
            editHref={`/blogs/${id}?edit=1`}
            reviewAction={reviewAction}
          >
            {blog.schedules.length > 0 ? (
              <div className="quiet-meta">
                {blog.schedules.slice(0, 3).map((schedule) => (
                  <Link href={`/schedule/${schedule.id}`} key={schedule.id}>
                    {new Date(schedule.scheduledFor).toLocaleDateString()} · {schedule.status}
                  </Link>
                ))}
              </div>
            ) : null}
          </ProductionFlowPanel>

          <QualityReviewPanel action={reviewAction} reviews={blog.qualityReviews} />

          <section className="quiet-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Brand guidance</p>
                <h3>Editorial guardrails</h3>
              </div>
              <span className="inline-chip">{brandProfiles.length} profiles loaded</span>
            </div>
            <BrandRuleGuide profiles={brandProfiles} />
          </section>
        </div>
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
