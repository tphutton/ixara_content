import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentForm } from "@/components/content/content-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { QualityReviewPanel } from "@/components/quality/quality-review-panel";
import { BrandRuleGuide } from "@/components/settings/brand-rule-guide";
import { prisma } from "@/lib/prisma";
import { reviewContentQualityAction } from "../../quality/actions";
import { deleteContentAction, updateContentAction } from "../actions";

export const dynamic = "force-dynamic";

type ContentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContentDetailPage({ params }: ContentDetailPageProps) {
  const { id } = await params;
  const [content, assets, brandProfiles] = await Promise.all([
    prisma.content.findUnique({
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

  if (!content) {
    notFound();
  }

  const updateAction = updateContentAction.bind(null, id);
  const deleteAction = deleteContentAction.bind(null, id);
  const reviewAction = reviewContentQualityAction.bind(null, id);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title={content.title}
        description="Edit content copy, targeting metadata, assets, and publication status."
      />

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 0.8fr", alignItems: "start" }}>
        <div className="stack">
        <Link className="button button--secondary" href="/content">
          Back to content
        </Link>

        <div className="card card--padded">
          <ContentForm
            action={updateAction}
            assets={assets}
            brandProfiles={brandProfiles}
            content={content}
          />
        </div>

        <form action={deleteAction}>
          <SubmitButton label="Delete content" pendingLabel="Deleting..." variant="secondary" />
        </form>
        </div>

        <div className="stack">
          <QualityReviewPanel action={reviewAction} reviews={content.qualityReviews} />
          <BrandRuleGuide profiles={brandProfiles} />
        </div>
      </div>
    </section>
  );
}
