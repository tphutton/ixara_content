import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentForm } from "@/components/content/content-form";
import { ContentVariantsPanel } from "@/components/content/content-variants-panel";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { QualityReviewPanel } from "@/components/quality/quality-review-panel";
import { BrandRuleGuide } from "@/components/settings/brand-rule-guide";
import { prisma } from "@/lib/prisma";
import {
  applyContentQualityRecommendationsAction,
  reviewContentQualityAction,
} from "../../quality/actions";
import { deleteContentAction, updateContentAction } from "../actions";
import { generateContentVariantsAction } from "./variant-actions";

export const dynamic = "force-dynamic";

type ContentDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ edit?: string }>;
};

export default async function ContentDetailPage({ params, searchParams }: ContentDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isEditing = resolvedSearchParams?.edit === "1";
  const [content, assets, brandProfiles] = await Promise.all([
    prisma.content.findUnique({
      where: { id },
      include: {
        qualityReviews: { orderBy: { createdAt: "desc" }, take: 5 },
        variants: { orderBy: { createdAt: "desc" }, take: 12 },
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

  if (!content) {
    notFound();
  }

  const updateAction = updateContentAction.bind(null, id);
  const deleteAction = deleteContentAction.bind(null, id);
  const reviewAction = reviewContentQualityAction.bind(null, id);
  const applyQualityAction = applyContentQualityRecommendationsAction.bind(null, id);
  const generateVariantsAction = generateContentVariantsAction.bind(null, id);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title={content.title}
        description="Review content quality, copy, targeting, and readiness before opening the editor."
        actions={
          <div className="header-actions">
            <Link className="button button--secondary" href="/content">
              Back
            </Link>
            <Link className="button button--primary" href={`/content/${id}?edit=1`}>
              Edit content
            </Link>
          </div>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 0.8fr", alignItems: "start" }}>
        <div className="stack">
          <section className="quiet-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Content preview</p>
                <h3>{content.hook ?? content.title}</h3>
              </div>
              <span className="inline-chip">{content.status}</span>
            </div>
            <div className="content-preview">
              {content.body ? <p>{content.body}</p> : <p className="muted">No body copy has been added yet.</p>}
              {content.cta ? <strong>{content.cta}</strong> : null}
            </div>
            <div className="quiet-meta quiet-meta--large">
              <span>{content.contentType}</span>
              <span>{content.platform ?? "No platform"}</span>
              <span>{content.brand ?? "No brand"}</span>
              <span>{content.campaignName ?? "No campaign"}</span>
            </div>
          </section>

          <section className="quiet-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Publishing metadata</p>
                <h3>Targeting and assets</h3>
              </div>
            </div>
            <div className="metadata-grid">
              <div><span>Tone</span><strong>{content.tone ?? "Not set"}</strong></div>
              <div><span>Audience</span><strong>{content.targetAudience ?? "Not set"}</strong></div>
              <div><span>Region</span><strong>{content.region ?? "Not set"}</strong></div>
              <div><span>Country</span><strong>{content.country ?? "Not set"}</strong></div>
              <div><span>Tags</span><strong>{content.tags.length ? content.tags.join(", ") : "Not set"}</strong></div>
              <div><span>Asset</span><strong>{content.assetImage ?? content.primaryAssetId ?? "Not set"}</strong></div>
            </div>
          </section>

          <ContentVariantsPanel action={generateVariantsAction} variants={content.variants} />
        </div>

        <div className="stack">
          <QualityReviewPanel
            action={reviewAction}
            applyAction={applyQualityAction}
            reviews={content.qualityReviews}
          />
          <BrandRuleGuide profiles={brandProfiles} />
        </div>
      </div>

      {isEditing ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close editor" href={`/content/${id}`} />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Editing</p>
                <h3>{content.title}</h3>
                <p className="muted">Update copy, targeting, assets, and workflow status.</p>
              </div>
              <Link className="button button--secondary" href={`/content/${id}`}>
                Close
              </Link>
            </div>
            <div className="editor-overlay__content">
              <ContentForm
                action={updateAction}
                assets={assets}
                brandProfiles={brandProfiles}
                content={content}
              />
            </div>
            <div className="editor-overlay__footer">
              <form action={deleteAction}>
                <SubmitButton label="Delete content" pendingLabel="Deleting..." variant="secondary" />
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
