"use server";

import {
  PublishedPostStatus,
  SocialPlatform,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createActionLog } from "@/lib/actions/action-log";
import { requireEditorialUserAccess } from "@/lib/auth/user-access";
import { parseNullableDate, parseOptionalString } from "@/lib/forms/parsers";
import { prisma } from "@/lib/prisma";

function parseEnum<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function parseOptionalInt(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createImportedPublishedPostAction(formData: FormData) {
  const access = await requireEditorialUserAccess();
  const platform = parseEnum(
    formData.get("platform"),
    Object.values(SocialPlatform),
    SocialPlatform.instagram,
  );
  const status = parseEnum(
    formData.get("status"),
    Object.values(PublishedPostStatus),
    PublishedPostStatus.imported,
  );

  const titleSnapshot = parseOptionalString(formData.get("titleSnapshot"));
  const captionSnapshot = parseOptionalString(formData.get("captionSnapshot"));
  const impressions = parseOptionalInt(formData.get("impressions"));
  const engagements = parseOptionalInt(formData.get("engagements"));
  const likes = parseOptionalInt(formData.get("likes"));
  const comments = parseOptionalInt(formData.get("comments"));
  const shares = parseOptionalInt(formData.get("shares"));
  const clicks = parseOptionalInt(formData.get("clicks"));
  const reach = impressions;
  const engagementRate =
    impressions && engagements ? Number(((engagements / impressions) * 100).toFixed(2)) : null;
  const clickThroughRate =
    impressions && clicks ? Number(((clicks / impressions) * 100).toFixed(2)) : null;

  const post = await prisma.publishedPost.create({
    data: {
      connectedAccountId: parseOptionalString(formData.get("connectedAccountId")),
      contentId: parseOptionalString(formData.get("contentId")),
      blogId: parseOptionalString(formData.get("blogId")),
      scheduleId: parseOptionalString(formData.get("scheduleId")),
      platform,
      platformAccountName: parseOptionalString(formData.get("platformAccountName")),
      externalPostId: parseOptionalString(formData.get("externalPostId")),
      externalPostUrl: parseOptionalString(formData.get("externalPostUrl")),
      titleSnapshot,
      captionSnapshot,
      status,
      publishedAt: parseNullableDate(formData.get("publishedAt")),
      importedAt: parseNullableDate(formData.get("importedAt")) ?? new Date(),
      latestAnalyticsAt:
        impressions !== null || engagements !== null || clicks !== null ? new Date() : null,
      createdById: access.id,
      updatedById: access.id,
    },
  });

  const hasAnalytics =
    impressions !== null ||
    engagements !== null ||
    likes !== null ||
    comments !== null ||
    shares !== null ||
    clicks !== null;

  if (hasAnalytics) {
    await prisma.postAnalyticsSnapshot.create({
      data: {
        publishedPostId: post.id,
        impressions,
        reach,
        engagements,
        likes,
        comments,
        shares,
        clicks,
        engagementRate,
        clickThroughRate,
      },
    });
  }

  await createActionLog({
    userId: access.id,
    actionType: "create",
    targetType: "published_post",
    targetId: post.id,
    summary: `Imported ${post.platform} post${titleSnapshot ? ` "${titleSnapshot}"` : ""}`,
    afterData: {
      postId: post.id,
      platform,
      titleSnapshot,
      impressions,
      engagements,
      clicks,
    },
    source: "manual",
  });

  revalidatePath("/analytics");
}

export async function deletePublishedPostAction(id: string) {
  const access = await requireEditorialUserAccess();
  const before = await prisma.publishedPost.findUniqueOrThrow({
    where: { id },
    include: { analyticsSnapshots: { select: { id: true } } },
  });

  await prisma.publishedPost.delete({ where: { id } });

  await createActionLog({
    userId: access.id,
    actionType: "delete",
    targetType: "published_post",
    targetId: id,
    summary: `Deleted ${before.platform} published post record${before.titleSnapshot ? ` "${before.titleSnapshot}"` : ""}`,
    beforeData: {
      id: before.id,
      platform: before.platform,
      titleSnapshot: before.titleSnapshot,
      externalPostId: before.externalPostId,
      analyticsSnapshots: before.analyticsSnapshots.length,
    },
    source: "manual",
  });

  revalidatePath("/analytics");
}
