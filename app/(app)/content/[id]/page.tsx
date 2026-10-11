import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPlanItemType, EditorialApprovalTargetType } from "@prisma/client";
import { EditorialApprovalPanel } from "@/components/approvals/editorial-approval-panel";
import { ContentForm } from "@/components/content/content-form";
import { ContentVariantsPanel } from "@/components/content/content-variants-panel";
import { ProductionFlowPanel } from "@/components/content/production-flow-panel";
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
import { deleteContentVariantAction, generateContentVariantsAction, selectContentVariantAction, updateContentVariantAction } from "./variant-actions";

export const dynamic = "force-dynamic";

type ContentDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ edit?: string; variant?: string; production?: string }>;
};

export default async function ContentDetailPage({ params, searchParams }: ContentDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isEditing = resolvedSearchParams?.edit === "1";
  const isViewingProduction = resolvedSearchParams?.production === "1";
  const [content, assets, brandProfiles] = await Promise.all([
    prisma.content.findUnique({
      where: { id },
      include: {
        qualityReviews: { orderBy: { createdAt: "desc" }, take: 5 },
        schedules: { select: { id: true, scheduledFor: true, status: true }, orderBy: { scheduledFor: "asc" } },
        variants: { orderBy: { createdAt: "desc" }, take: 12 },
        planItems: {
          where: { itemType: ContentPlanItemType.video },
          include: { videoBrief: { include: { shots: { orderBy: { sortOrder: "asc" } } } }, plan: { select: { id: true, title: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
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
  const deleteVariantAction = deleteContentVariantAction.bind(null, id);
  const updateVariantAction = updateContentVariantAction.bind(null, id);
  const selectVariantAction = selectContentVariantAction.bind(null, id);
  const latestQualityReview = content.qualityReviews[0] ?? null;
  const productionItem = content.planItems.find((item) => item.videoBrief) ?? null;
  const productionBrief = productionItem?.videoBrief ?? null;
  const productionSections = productionBrief
    ? Array.from(productionBrief.shots.reduce((groups, shot) => {
        const section = shot.purpose?.split(" · ")[0] ?? "sequence";
        const current = groups.get(section) ?? { section, duration: 0, shots: 0 };
        current.duration += shot.durationSeconds;
        current.shots += 1;
        groups.set(section, current);
        return groups;
      }, new Map<string, { section: string; duration: number; shots: number }>()).values())
    : [];

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
            {productionBrief ? (
              <div className="form-actions">
                <Link className="button button--secondary" href={`/content/${id}?production=1`}>
                  View production plan
                </Link>
                <span className="muted">{productionBrief.shots.length} shots · {productionBrief.durationSeconds}s · {productionBrief.aspectRatio}</span>
              </div>
            ) : null}
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

          <ContentVariantsPanel
            action={generateVariantsAction}
            contentId={content.id}
            deleteAction={deleteVariantAction}
            editVariantId={resolvedSearchParams?.variant}
            selectAction={selectVariantAction}
            selectedVariantId={content.selectedVariantId}
            updateAction={updateVariantAction}
            variants={content.variants}
          />
        </div>

        <div className="stack">
          <EditorialApprovalPanel path={`/content/${id}`} targetId={content.id} targetType={EditorialApprovalTargetType.content} />
          <ProductionFlowPanel
            kind="content"
            recordId={content.id}
            status={content.status}
            hasBody={Boolean(content.body || content.hook)}
            hasBrand={Boolean(content.brand)}
            hasAudience={Boolean(content.targetAudience)}
            hasAsset={Boolean(content.primaryAssetId || content.assetImage)}
            variantCount={content.variants.length}
            latestQualityScore={latestQualityReview?.overallScore}
            scheduleCount={content.schedules.length}
            editHref={`/content/${id}?edit=1`}
            reviewAction={reviewAction}
            applyQualityAction={applyQualityAction}
            generateVariantsAction={generateVariantsAction}
          >
            {content.schedules.length > 0 ? (
              <div className="quiet-meta">
                {content.schedules.slice(0, 3).map((schedule) => (
                  <Link href={`/schedule/${schedule.id}`} key={schedule.id}>
                    {new Date(schedule.scheduledFor).toLocaleDateString()} · {schedule.status}
                  </Link>
                ))}
              </div>
            ) : null}
          </ProductionFlowPanel>

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

      {isViewingProduction && productionBrief && productionItem ? (
        <div className="editor-overlay editor-overlay--dialog">
          <div className="editor-overlay__backdrop"><Link aria-label="Close production plan" href={`/content/${id}`} /></div>
          <section className="editor-overlay__panel video-production-modal">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Production plan · {productionItem.plan.title}</p>
                <h3>{content.title}</h3>
                <div className="toolbar__group"><span className="inline-chip">{productionBrief.durationSeconds}s</span><span className="inline-chip">{productionBrief.aspectRatio}</span><span className="inline-chip">{productionBrief.targetPlatforms.join(", ")}</span></div>
              </div>
              <Link className="button button--secondary" href={`/content/${id}`}>Close</Link>
            </div>
            <div className="editor-overlay__content stack">
              <section className="video-production-overview">
                <div><p className="kicker">Concept</p><p>{productionBrief.concept}</p></div>
                <div className="video-production-overview__grid"><div><p className="kicker">Voiceover / delivery</p><p className="preserve-lines">{productionBrief.voiceover ?? "Not set"}</p></div><div><p className="kicker">Audio direction</p><p className="preserve-lines">{productionBrief.audioDirection ?? "Not set"}</p></div><div><p className="kicker">Visual direction</p><p className="preserve-lines">{productionBrief.visualDirection ?? "Not set"}</p></div><div><p className="kicker">Generation strategy</p><p className="preserve-lines">{productionBrief.generationStrategy ?? "Not set"}</p></div></div>
              </section>
              <div className="video-section-strip">{productionSections.map((section) => <div key={section.section}><span>{section.section.replaceAll("_", " ")}</span><strong>{section.duration}s</strong><small>{section.shots} shot{section.shots === 1 ? "" : "s"}</small></div>)}</div>
              <div className="video-shot-list">
                {productionBrief.shots.map((shot) => (
                  <article className="video-shot-row" key={shot.id}>
                    <div className="video-shot-row__index">{shot.sortOrder + 1}</div>
                    <div className="video-shot-row__time"><strong>{shot.durationSeconds}s</strong><span>{shot.status}</span></div>
                    <div className="video-shot-row__body"><div className="section-heading"><div><p className="kicker">{shot.purpose?.split(" · ")[0]?.replaceAll("_", " ") ?? "Sequence"}</p><h4>{shot.title}</h4></div></div><p className="preserve-lines">{shot.prompt}</p><details><summary>Production detail</summary><div className="video-shot-detail"><p><strong>Camera / composition:</strong> {shot.cameraDirection ?? "Not set"}</p><p className="preserve-lines"><strong>Visual and sound:</strong> {shot.visualDetails ?? "Not set"}</p>{shot.voiceover ? <p><strong>Voiceover:</strong> {shot.voiceover}</p> : null}</div></details></div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
