import {
  BlogStatus,
  ConnectedAccountStatus,
  ContentStatus,
  PublishedPostStatus,
  ScheduleStatus,
  SocialPlatform,
  type ConnectedAccount,
  type ContentSchedule,
  type QualityReview,
  type UserAccess,
} from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { getQualityGate } from "@/lib/quality/gates";
import { prisma } from "@/lib/prisma";
import {
  MetaReauthRequiredError,
  assertMetaAccountReadyForSync,
  getStoredMetaToken,
  isMetaPlatform,
  metaPost,
} from "@/lib/social/meta";

type ScheduleForPublish = ContentSchedule & {
  content: {
    id: string;
    title: string;
    body: string | null;
    hook: string | null;
    cta: string | null;
    platform: string | null;
    status: ContentStatus;
    brand: string | null;
    assetImage: string | null;
    assetCaption: string | null;
    primaryAsset: { fileUrl: string; title: string } | null;
    qualityReviews: QualityReview[];
  } | null;
  blog: {
    id: string;
    title: string;
    text1: string | null;
    status: BlogStatus;
    brand: string | null;
    featureImage: string | null;
    featureAsset: { fileUrl: string; title: string } | null;
    qualityReviews: QualityReview[];
  } | null;
  publishedPosts: Array<{ id: string; status: PublishedPostStatus }>;
};

export type PublishReadiness = {
  ready: boolean;
  label: string;
  reasons: string[];
  platform: SocialPlatform | null;
  account: Pick<ConnectedAccount, "id" | "accountName" | "accountHandle" | "platform" | "status"> | null;
};

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

function stripHtml(value: string | null | undefined) {
  return clean(value)?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ?? null;
}

export function inferMetaPlatform(schedule: Pick<ContentSchedule, "channel" | "platformAccount"> & { content?: { platform: string | null } | null }) {
  const value = [schedule.channel, schedule.platformAccount, schedule.content?.platform]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (value.includes("instagram") || value.includes("ig")) return SocialPlatform.instagram;
  if (value.includes("facebook") || value.includes("meta")) return SocialPlatform.facebook;
  return null;
}

function scoreAccount(schedule: ScheduleForPublish, account: ConnectedAccount, platform: SocialPlatform) {
  if (account.platform !== platform) return -100;
  if (account.status !== ConnectedAccountStatus.active) return -50;

  let score = 0;
  const scheduleAccount = schedule.platformAccount?.toLowerCase();
  const scheduleBrand = (schedule.brand ?? schedule.content?.brand ?? schedule.blog?.brand)?.toLowerCase();

  if (scheduleAccount) {
    const accountName = account.accountName.toLowerCase();
    const handle = account.accountHandle?.toLowerCase().replace(/^@/, "");
    if (accountName.includes(scheduleAccount) || scheduleAccount.includes(accountName)) score += 6;
    if (handle && scheduleAccount.includes(handle)) score += 6;
  }

  if (scheduleBrand && account.brandName?.toLowerCase() === scheduleBrand) score += 4;
  if (account.encryptedAccessToken) score += 2;
  return score;
}

export function choosePublishingAccount(schedule: ScheduleForPublish, accounts: ConnectedAccount[]) {
  const platform = inferMetaPlatform(schedule);
  if (!platform) return { platform: null, account: null };

  const candidates = accounts
    .filter((account) => account.platform === platform)
    .sort((a, b) => scoreAccount(schedule, b, platform) - scoreAccount(schedule, a, platform));

  return { platform, account: candidates[0] ?? null };
}

function getCaption(schedule: ScheduleForPublish) {
  if (schedule.content) {
    return [schedule.content.hook, schedule.content.body, schedule.content.cta]
      .map(stripHtml)
      .filter(Boolean)
      .join("\n\n");
  }

  if (schedule.blog) {
    return [schedule.blog.title, stripHtml(schedule.blog.text1)].filter(Boolean).join("\n\n");
  }

  return "";
}

function getTitle(schedule: ScheduleForPublish) {
  return schedule.content?.title ?? schedule.blog?.title ?? "Scheduled post";
}

function getMediaUrl(schedule: ScheduleForPublish) {
  return (
    clean(schedule.content?.primaryAsset?.fileUrl) ??
    clean(schedule.content?.assetImage) ??
    clean(schedule.blog?.featureAsset?.fileUrl) ??
    clean(schedule.blog?.featureImage)
  );
}

export function getMetaPublishReadiness(schedule: ScheduleForPublish, accounts: ConnectedAccount[]): PublishReadiness {
  const reasons: string[] = [];
  const { platform, account } = choosePublishingAccount(schedule, accounts);
  const latestReview = schedule.content?.qualityReviews[0] ?? schedule.blog?.qualityReviews[0] ?? null;
  const qualityGate = getQualityGate(latestReview);
  const caption = getCaption(schedule);
  const mediaUrl = getMediaUrl(schedule);

  if (schedule.status === ScheduleStatus.published || schedule.publishedPosts.some((post) => post.status === PublishedPostStatus.published)) {
    reasons.push("Already published.");
  }
  if (!schedule.content && !schedule.blog) reasons.push("No content or blog is linked.");
  if (!schedule.approvedById) reasons.push("Schedule is not approved.");
  if (!qualityGate.ready) reasons.push(`Quality gate: ${qualityGate.label}.`);
  if (!platform) reasons.push("Channel must be Facebook or Instagram for Meta publishing.");
  if (!account) reasons.push("No matching active Meta account is connected.");
  if (account && account.status !== ConnectedAccountStatus.active) reasons.push("Matching account is not active.");
  if (account && !account.encryptedAccessToken) reasons.push("Matching account is not authorized with Meta.");
  if (platform === SocialPlatform.facebook && account && !account.externalAccountId) {
    reasons.push("Facebook account is missing the Meta page ID.");
  }
  if (platform === SocialPlatform.instagram && account) {
    const igBusinessId =
      (account.metadata as { instagramBusinessAccountId?: string } | null)?.instagramBusinessAccountId ??
      account.externalAccountId;
    if (!igBusinessId) reasons.push("Instagram account is missing the business account ID.");
  }
  if (!caption) reasons.push("No publishable caption/body copy is available.");
  if (platform === SocialPlatform.instagram && !mediaUrl) reasons.push("Instagram publishing requires an image URL.");

  return {
    ready: reasons.length === 0,
    label: reasons.length === 0 ? "Ready to publish to Meta" : "Needs work before Meta publishing",
    reasons,
    platform,
    account: account
      ? {
          id: account.id,
          accountName: account.accountName,
          accountHandle: account.accountHandle,
          platform: account.platform,
          status: account.status,
        }
      : null,
  };
}

async function publishFacebook(input: {
  pageId: string;
  token: string;
  caption: string;
  mediaUrl: string | null;
}) {
  if (input.mediaUrl) {
    const result = await metaPost<{ id?: string; post_id?: string }>(`/${input.pageId}/photos`, input.token, {
      url: input.mediaUrl,
      caption: input.caption,
      published: "true",
    });
    return { externalPostId: result.post_id ?? result.id, externalPostUrl: result.post_id ? `https://www.facebook.com/${result.post_id}` : null };
  }

  const result = await metaPost<{ id?: string }>(`/${input.pageId}/feed`, input.token, {
    message: input.caption,
  });
  return { externalPostId: result.id, externalPostUrl: result.id ? `https://www.facebook.com/${result.id}` : null };
}

async function publishInstagram(input: {
  igBusinessId: string;
  token: string;
  caption: string;
  mediaUrl: string;
}) {
  const container = await metaPost<{ id?: string }>(`/${input.igBusinessId}/media`, input.token, {
    image_url: input.mediaUrl,
    caption: input.caption,
  });

  if (!container.id) {
    throw new Error("Meta did not return an Instagram media container ID.");
  }

  const result = await metaPost<{ id?: string }>(`/${input.igBusinessId}/media_publish`, input.token, {
    creation_id: container.id,
  });

  return { externalPostId: result.id, externalPostUrl: result.id ? `https://www.instagram.com/p/${result.id}` : null };
}

export async function publishScheduleToMeta(input: {
  scheduleId: string;
  access: UserAccess;
}) {
  const schedule = await prisma.contentSchedule.findUniqueOrThrow({
    where: { id: input.scheduleId },
    include: {
      content: {
        include: {
          primaryAsset: { select: { fileUrl: true, title: true } },
          qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      blog: {
        include: {
          featureAsset: { select: { fileUrl: true, title: true } },
          qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      publishedPosts: { select: { id: true, status: true } },
    },
  });
  const accounts = await prisma.connectedAccount.findMany({
    where: {
      platform: { in: [SocialPlatform.facebook, SocialPlatform.instagram] },
      status: ConnectedAccountStatus.active,
    },
  });
  const readiness = getMetaPublishReadiness(schedule, accounts);

  if (!readiness.ready || !readiness.account || !readiness.platform) {
    throw new Error(`Schedule is not ready to publish: ${readiness.reasons.join(" ")}`);
  }

  const account = accounts.find((item) => item.id === readiness.account?.id);
  if (!account || !isMetaPlatform(account.platform)) {
    throw new Error("A matching Meta account is required before publishing.");
  }

  assertMetaAccountReadyForSync(account);
  const token = getStoredMetaToken(account);
  if (!token) {
    throw new MetaReauthRequiredError("Meta account is missing an access token. Reconnect the account.");
  }

  const caption = getCaption(schedule);
  const mediaUrl = getMediaUrl(schedule);
  const published =
    readiness.platform === SocialPlatform.facebook
      ? await publishFacebook({
          pageId: account.externalAccountId as string,
          token,
          caption,
          mediaUrl,
        })
      : await publishInstagram({
          igBusinessId:
            ((account.metadata as { instagramBusinessAccountId?: string } | null)?.instagramBusinessAccountId ??
              account.externalAccountId) as string,
          token,
          caption,
          mediaUrl: mediaUrl as string,
        });

  if (!published.externalPostId) {
    throw new Error("Meta did not return a published post ID.");
  }

  const publishedPost = await prisma.publishedPost.create({
    data: {
      connectedAccountId: account.id,
      contentId: schedule.contentId,
      blogId: schedule.blogId,
      scheduleId: schedule.id,
      platform: account.platform,
      platformAccountName: account.accountName,
      externalPostId: published.externalPostId,
      externalPostUrl: published.externalPostUrl,
      titleSnapshot: getTitle(schedule),
      captionSnapshot: caption,
      mediaSnapshot: mediaUrl ? { url: mediaUrl } : undefined,
      status: PublishedPostStatus.published,
      publishedAt: new Date(),
      createdById: input.access.id,
      updatedById: input.access.id,
    },
  });

  await prisma.contentSchedule.update({
    where: { id: schedule.id },
    data: { status: ScheduleStatus.published },
  });

  if (schedule.contentId) {
    await prisma.content.update({
      where: { id: schedule.contentId },
      data: { status: ContentStatus.published, updatedById: input.access.id },
    });
  }

  if (schedule.blogId) {
    await prisma.blog.update({
      where: { id: schedule.blogId },
      data: { status: BlogStatus.published, updatedById: input.access.id },
    });
  }

  await createActionLog({
    userId: input.access.id,
    actionType: "publish",
    targetType: "schedule",
    targetId: schedule.id,
    summary: `Published schedule entry to ${account.platform} account "${account.accountName}"`,
    beforeData: schedule,
    afterData: {
      publishedPost,
      externalPostId: published.externalPostId,
      externalPostUrl: published.externalPostUrl,
    },
    source: "manual",
  });

  return publishedPost;
}
