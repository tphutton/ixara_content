"use server";

import { QualityReviewTargetType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { applyContentQualityRecommendations } from "@/lib/quality/apply-recommendations";
import { runQualityReview } from "@/lib/quality/editorial-review";

export async function reviewContentQualityAction(id: string) {
  const access = await requireApprovedUserAccess();
  await runQualityReview({
    targetType: QualityReviewTargetType.content,
    targetId: id,
    createdById: access.id,
    source: "manual",
  });
  revalidatePath(`/content/${id}`);
}

export async function applyContentQualityRecommendationsAction(id: string) {
  const access = await requireApprovedUserAccess();
  await applyContentQualityRecommendations({
    contentId: id,
    userId: access.id,
    source: "manual",
  });
  revalidatePath("/content");
  revalidatePath(`/content/${id}`);
}

export async function reviewBlogQualityAction(id: string) {
  const access = await requireApprovedUserAccess();
  await runQualityReview({
    targetType: QualityReviewTargetType.blog,
    targetId: id,
    createdById: access.id,
    source: "manual",
  });
  revalidatePath(`/blogs/${id}`);
}

export async function reviewPlanItemQualityAction(planId: string, itemId: string) {
  const access = await requireApprovedUserAccess();
  await runQualityReview({
    targetType: QualityReviewTargetType.content_plan_item,
    targetId: itemId,
    createdById: access.id,
    source: "manual",
  });
  revalidatePath(`/plans/${planId}`);
}
