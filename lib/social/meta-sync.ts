import { metricRate } from "@/lib/social/reporting";
import {
  BlogStatus,
  ConnectedAccountStatus,
  ContentStatus,
  PublishedPostStatus,
  ScheduleStatus,
  SocialPlatform,
  type ConnectedAccount,
} from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { prisma } from "@/lib/prisma";
import {
  MetaReauthRequiredError,
  assertMetaAccountReadyForSync,
  fetchFacebookPagePosts,
  fetchFacebookPostInsights,
  type MetaInsight,
  fetchInstagramMedia,
  fetchInstagramMediaInsights,
  getStoredMetaToken,
} from "@/lib/social/meta";

type DeliveryCandidate = {
  id: string;
  captionSnapshot: string | null;
  createdAt: Date;
};

export function chooseDeliveryReconciliationCandidate(
  candidates: DeliveryCandidate[],
  caption: string | null,
  publishedAt: Date | null,
) {
  if (!caption || !publishedAt) return null;

  const windowMs = 60 * 60 * 1000;
  const matches = candidates
    .filter((candidate) =>
      candidate.captionSnapshot === caption &&
      Math.abs(candidate.createdAt.getTime() - publishedAt.getTime()) <= windowMs,
    )
    .sort((a, b) =>
      Math.abs(a.createdAt.getTime() - publishedAt.getTime()) -
      Math.abs(b.createdAt.getTime() - publishedAt.getTime()),
    );

  return matches.length === 1 ? matches[0] : null;
}

export function getInsightValue(insights: MetaInsight[], name: string) {
  const metric = insights.find((item) => item.name === name);
  const value = metric?.total_value?.value ?? metric?.values?.[0]?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function upsertPublishedPostBase(input: {
  account: ConnectedAccount;
  externalPostId: string;
  titleSnapshot: string | null;
  captionSnapshot: string | null;
  externalPostUrl: string | null;
  publishedAt: Date | null;
  unavailableMetrics?: string[];
  metrics: {
    views?: number | null;
    impressions?: number | null;
    reach?: number | null;
    engagements?: number | null;
    likes?: number | null;
    comments?: number | null;
    shares?: number | null;
    saves?: number | null;
    clicks?: number | null;
  };
}) {
  const existingPost = await prisma.publishedPost.findUnique({
    where: {
      platform_externalPostId: {
        platform: input.account.platform,
        externalPostId: input.externalPostId,
      },
    },
  });
  const deliveryCandidates = existingPost ? [] : await prisma.publishedPost.findMany({
    where: {
      connectedAccountId: input.account.id,
      status: PublishedPostStatus.draft,
      externalPostId: null,
      captionSnapshot: input.captionSnapshot,
    },
    select: { id: true, captionSnapshot: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const deliveryCandidate = chooseDeliveryReconciliationCandidate(
    deliveryCandidates,
    input.captionSnapshot,
    input.publishedAt,
  );

  const publishedPost = await prisma.$transaction(async (tx) => {
    const current = await tx.connectedAccount.findUniqueOrThrow({ where: { id: input.account.id } });
    if (current.externalAccountId !== input.account.externalAccountId) {
      throw new Error("Account connection changed during sync. Retry sync for the selected account.");
    }
    const data = {
      connectedAccountId: input.account.id,
      platformAccountName: existingPost?.platformAccountName ?? input.account.accountName,
      sourceExternalAccountId: existingPost?.sourceExternalAccountId ?? input.account.externalAccountId,
      sourceBrandName: existingPost?.sourceBrandName ?? input.account.brandName,
      externalPostId: input.externalPostId,
      externalPostUrl: input.externalPostUrl,
      titleSnapshot: input.titleSnapshot,
      captionSnapshot: input.captionSnapshot,
      status: PublishedPostStatus.published,
      publishedAt: input.publishedAt,
      importedAt: new Date(),
      latestAnalyticsAt: new Date(),
      deliveryError: null,
    };

    const post = existingPost
      ? await tx.publishedPost.update({ where: { id: existingPost.id }, data })
      : deliveryCandidate
        ? await tx.publishedPost.update({ where: { id: deliveryCandidate.id }, data })
        : await tx.publishedPost.create({
            data: {
              ...data,
              platform: input.account.platform,
            },
          });

    if (deliveryCandidate && post.scheduleId) {
      await tx.contentSchedule.update({
        where: { id: post.scheduleId },
        data: { status: ScheduleStatus.published },
      });
      if (post.contentId) {
        await tx.content.update({ where: { id: post.contentId }, data: { status: ContentStatus.published } });
      }
      if (post.blogId) {
        await tx.blog.update({ where: { id: post.blogId }, data: { status: BlogStatus.published } });
      }
    }

    return post;
  });

  const impressions = input.metrics.impressions ?? null;
  const engagements = input.metrics.engagements ?? null;
  const clicks = input.metrics.clicks ?? null;
  const engagementRate =
    metricRate(engagements, impressions);
  const clickThroughRate =
    metricRate(clicks, impressions);

  await prisma.postAnalyticsSnapshot.create({
    data: {
      publishedPostId: publishedPost.id,
      impressions,
      views: input.metrics.views ?? null,
      reach: input.metrics.reach ?? null,
      engagements,
      likes: input.metrics.likes ?? null,
      comments: input.metrics.comments ?? null,
      shares: input.metrics.shares ?? null,
      saves: input.metrics.saves ?? null,
      clicks,
      engagementRate,
      clickThroughRate,
      metadata: { source: "meta", unavailableMetrics: input.unavailableMetrics ?? [] },
    },
  });

  return { publishedPost, reconciled: Boolean(deliveryCandidate) };
}

async function syncFacebookAccount(account: ConnectedAccount) {
  if (!account.externalAccountId) {
    throw new Error("Connected account is missing the Meta page ID.");
  }

  assertMetaAccountReadyForSync(account);
  const token = getStoredMetaToken(account);

  if (!token) {
    throw new MetaReauthRequiredError("Meta account is missing an access token. Reconnect the account.");
  }

  const posts = await fetchFacebookPagePosts(account.externalAccountId, token);

  const synced = [];
  let reconciled = 0;
  let postsWithUnavailableInsights = 0;

  for (const post of posts) {
    const resultInsights = await fetchFacebookPostInsights(post.id, token);
    const insights = resultInsights.data;
    if (resultInsights.unavailable.length) postsWithUnavailableInsights += 1;

    const result = await upsertPublishedPostBase({
      account,
      externalPostId: post.id,
      titleSnapshot: post.message?.split("\n")[0]?.slice(0, 120) ?? null,
      captionSnapshot: post.message ?? null,
      externalPostUrl: post.permalink_url ?? null,
      publishedAt: post.created_time ? new Date(post.created_time) : null,
      unavailableMetrics: resultInsights.unavailable,
      metrics: {
        views: getInsightValue(insights, "post_media_view"),
        clicks: getInsightValue(insights, "post_clicks"),
        shares: post.shares?.count ?? null,
      },
    });

    synced.push(result.publishedPost.id);
    if (result.reconciled) reconciled += 1;
  }

  return { synced, reconciled, postsWithUnavailableInsights };
}

async function syncInstagramAccount(account: ConnectedAccount) {
  assertMetaAccountReadyForSync(account);
  const token = getStoredMetaToken(account);

  if (!token) {
    throw new MetaReauthRequiredError("Meta account is missing an access token. Reconnect the account.");
  }

  const igBusinessId =
    (account.metadata as { instagramBusinessAccountId?: string } | null)?.instagramBusinessAccountId ??
    account.externalAccountId;

  if (!igBusinessId) {
    throw new Error("Connected account is missing the Instagram business account ID.");
  }

  const media = await fetchInstagramMedia(igBusinessId, token);
  const synced = [];
  let reconciled = 0;
  let postsWithUnavailableInsights = 0;

  for (const item of media) {
    const resultInsights = await fetchInstagramMediaInsights(item.id, token);
    const insights = resultInsights.data;
    if (resultInsights.unavailable.length) postsWithUnavailableInsights += 1;

    const result = await upsertPublishedPostBase({
      account,
      externalPostId: item.id,
      titleSnapshot: item.caption?.split("\n")[0]?.slice(0, 120) ?? null,
      captionSnapshot: item.caption ?? null,
      externalPostUrl: item.permalink ?? null,
      publishedAt: item.timestamp ? new Date(item.timestamp) : null,
      unavailableMetrics: resultInsights.unavailable,
      metrics: {
        views: getInsightValue(insights, "views"),
        reach: getInsightValue(insights, "reach"),
        engagements:
          getInsightValue(insights, "total_interactions"),
        likes: item.like_count ?? null,
        comments: item.comments_count ?? null,
        saves: getInsightValue(insights, "saved"),
        shares: getInsightValue(insights, "shares"),
      },
    });

    synced.push(result.publishedPost.id);
    if (result.reconciled) reconciled += 1;
  }

  return { synced, reconciled, postsWithUnavailableInsights };
}

export async function syncConnectedMetaAccount(input: {
  accountId: string;
  userId?: string;
  source?: "manual" | "scheduled" | "ai";
}) {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: input.accountId },
    include: { brandProfile: { select: { brandName: true } } },
  });

  if (
    account.platform !== SocialPlatform.facebook &&
    account.platform !== SocialPlatform.instagram
  ) {
    throw new Error("Meta sync is only supported for Facebook and Instagram accounts.");
  }

  let syncedIds: string[] = [];
  let reconciledCount = 0;
  let unavailableCount = 0;

  try {
    const syncResult =
      account.platform === SocialPlatform.facebook
        ? await syncFacebookAccount({ ...account, brandName: account.brandProfile?.brandName ?? account.brandName })
        : await syncInstagramAccount({ ...account, brandName: account.brandProfile?.brandName ?? account.brandName });
    syncedIds = syncResult.synced;
    reconciledCount = syncResult.reconciled;
    unavailableCount = syncResult.postsWithUnavailableInsights;

    const updatedAccount = await prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        status: ConnectedAccountStatus.active,
        lastSyncedAt: new Date(),
        lastSyncStatus: `Synced ${syncedIds.length} post${syncedIds.length === 1 ? "" : "s"} from Meta${reconciledCount > 0 ? ` and reconciled ${reconciledCount} ${reconciledCount === 1 ? "delivery" : "deliveries"}` : ""}${unavailableCount ? `; insights unavailable for ${unavailableCount} posts (permissions, media eligibility or retention)` : ""}`,
      },
    });

    if (input.userId) {
      await createActionLog({
        userId: input.userId,
        actionType: "sync",
        targetType: "connected_account",
        targetId: account.id,
        summary: `Synced ${updatedAccount.platform} account "${updatedAccount.accountName}" from Meta`,
        afterData: {
          syncedPostIds: syncedIds,
        },
        source: input.source ?? "manual",
      });
    }

    return {
      syncedCount: syncedIds.length,
      reconciledCount,
      postsWithUnavailableInsights: unavailableCount,
      syncedPostIds: syncedIds,
      account: updatedAccount,
    };
  } catch (error) {
    const needsReauth = error instanceof MetaReauthRequiredError;

    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        status: needsReauth ? ConnectedAccountStatus.needs_reauth : ConnectedAccountStatus.error,
        lastSyncStatus: error instanceof Error ? error.message : "Meta sync failed.",
      },
    });

    throw error;
  }
}
