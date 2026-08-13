import { prisma } from "@/lib/prisma";

export const QUALITY_TARGET_SCORE = 70;

function getReviewHref(review: QualityReviewSummaryItem) {
  if (review.contentId) return `/content/${review.contentId}`;
  if (review.blogId) return `/blogs/${review.blogId}`;
  if (review.planItemId && review.planId) return `/plans/${review.planId}`;
  return "/quality";
}

export type QualityReviewSummaryItem = {
  id: string;
  targetType: string;
  targetTitle: string;
  contentId: string | null;
  blogId: string | null;
  planItemId: string | null;
  planId: string | null;
  brand: string | null;
  verdict: string;
  overallScore: number;
  riskScore: number;
  summary: string;
  recommendations: string[];
  createdAt: Date;
};

export async function getQualityCommandSummary() {
  const [reviews, contentMissingReview, blogsMissingReview, planItemsMissingReview] =
    await Promise.all([
      prisma.qualityReview.findMany({
        include: {
          content: { select: { id: true, title: true, brand: true, status: true } },
          blog: { select: { id: true, title: true, brand: true, status: true } },
          planItem: {
            select: {
              id: true,
              title: true,
              brand: true,
              status: true,
              plan: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      prisma.content.findMany({
        where: {
          qualityReviews: { none: {} },
          status: { in: ["idea", "draft", "approved", "scheduled"] },
        },
        select: { id: true, title: true, brand: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.blog.findMany({
        where: {
          qualityReviews: { none: {} },
          status: { in: ["idea", "draft", "review", "approved"] },
        },
        select: { id: true, title: true, brand: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.contentPlanItem.findMany({
        where: {
          qualityReviews: { none: {} },
          status: { in: ["planned", "approved", "created", "scheduled"] },
        },
        select: {
          id: true,
          title: true,
          brand: true,
          status: true,
          updatedAt: true,
          plan: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
    ]);

  const latestByTarget = new Map<string, QualityReviewSummaryItem>();

  for (const review of reviews) {
    const key = `${review.targetType}:${review.contentId ?? review.blogId ?? review.planItemId}`;

    if (latestByTarget.has(key)) {
      continue;
    }

    const item: QualityReviewSummaryItem = {
      id: review.id,
      targetType: review.targetType,
      targetTitle:
        review.content?.title ??
        review.blog?.title ??
        review.planItem?.title ??
        "Unknown target",
      contentId: review.contentId,
      blogId: review.blogId,
      planItemId: review.planItemId,
      planId: review.planItem?.plan.id ?? null,
      brand: review.content?.brand ?? review.blog?.brand ?? review.planItem?.brand ?? null,
      verdict: review.verdict,
      overallScore: review.overallScore,
      riskScore: review.riskScore,
      summary: review.summary,
      recommendations: review.recommendations,
      createdAt: review.createdAt,
    };

    latestByTarget.set(key, item);
  }

  const latestReviews = Array.from(latestByTarget.values());
  const weakReviews = latestReviews
    .filter(
      (review) =>
        review.overallScore < QUALITY_TARGET_SCORE ||
        review.riskScore < QUALITY_TARGET_SCORE ||
        review.verdict !== "publish_ready",
    )
    .sort((a, b) => a.overallScore - b.overallScore || a.riskScore - b.riskScore)
    .slice(0, 16);

  const publishReady = latestReviews.filter(
    (review) => review.overallScore >= QUALITY_TARGET_SCORE && review.verdict === "publish_ready",
  );
  const averageScore =
    latestReviews.length > 0
      ? Math.round(
          latestReviews.reduce((total, review) => total + review.overallScore, 0) /
            latestReviews.length,
        )
      : 0;
  const missingReviewItems = [
    ...contentMissingReview.map((item) => ({
      id: item.id,
      title: item.title,
      type: "content",
      brand: item.brand,
      status: item.status,
      updatedAt: item.updatedAt,
      href: `/content/${item.id}`,
    })),
    ...blogsMissingReview.map((item) => ({
      id: item.id,
      title: item.title,
      type: "blog",
      brand: item.brand,
      status: item.status,
      updatedAt: item.updatedAt,
      href: `/blogs/${item.id}`,
    })),
    ...planItemsMissingReview.map((item) => ({
      id: item.id,
      title: item.title,
      type: "plan_item",
      brand: item.brand,
      status: item.status,
      updatedAt: item.updatedAt,
      href: `/plans/${item.plan.id}`,
    })),
  ]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 18);

  return {
    metrics: [
      {
        label: "Reviewed targets",
        value: latestReviews.length,
        detail: "Latest saved quality reviews across content, blogs, and plan items",
      },
      {
        label: "Average score",
        value: averageScore,
        detail: `Target quality score is ${QUALITY_TARGET_SCORE}+ before approval`,
      },
      {
        label: "Needs work",
        value: weakReviews.length,
        detail: "Latest review is below target, risky, or not publish-ready",
      },
      {
        label: "Missing review",
        value: missingReviewItems.length,
        detail: "Active work with no saved quality review yet",
      },
    ],
    latestReviews: latestReviews.slice(0, 24).map((review) => ({
      ...review,
      href: getReviewHref(review),
    })),
    weakReviews: weakReviews.map((review) => ({
      ...review,
      href: getReviewHref(review),
    })),
    missingReviewItems,
    publishReadyCount: publishReady.length,
  };
}
