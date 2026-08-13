import {
  BlogStatus,
  ContentStatus,
  ScheduleStatus,
  SocialPlatform,
} from "@prisma/client";
import { getAutomationHealthSummary } from "@/lib/automation/runner";
import { safeListCampaigns } from "@/lib/campaigns/client";
import { getBlogReadiness } from "@/lib/blogs/readiness";
import { prisma } from "@/lib/prisma";
import { getScheduleReadiness } from "@/lib/schedule/readiness";

type BrandCoverage = {
  brand: string;
  scheduled: number;
  ready: number;
  attention: number;
  drafts: number;
  blogs: number;
  campaigns: number;
};

function labelOrUnknown(value: string | null | undefined) {
  return value?.trim() || "Unassigned";
}

function addToMap(map: Map<string, number>, key: string | null | undefined, count = 1) {
  const resolvedKey = labelOrUnknown(key);
  map.set(resolvedKey, (map.get(resolvedKey) ?? 0) + count);
}

function topEntries(map: Map<string, number>, limit = 6) {
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export async function getContentCommandCenter() {
  const now = new Date();
  const nextTwoWeeks = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
  const lastThirtyDays = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);

  const [
    contentRows,
    blogRows,
    scheduleRows,
    assetCount,
    automationHealth,
    campaignsResponse,
    connectedAccounts,
    publishedPosts,
    recentActions,
  ] = await Promise.all([
    prisma.content.findMany({
      orderBy: { updatedAt: "desc" },
      take: 120,
    }),
    prisma.blog.findMany({
      orderBy: { updatedAt: "desc" },
      take: 120,
    }),
    prisma.contentSchedule.findMany({
      where: {
        scheduledFor: {
          gte: now,
          lte: nextTwoWeeks,
        },
        status: {
          notIn: [ScheduleStatus.cancelled, ScheduleStatus.missed],
        },
      },
      include: {
        content: {
          select: {
            title: true,
            brand: true,
            tone: true,
            targetAudience: true,
            primaryAssetId: true,
            assetImage: true,
          },
        },
        blog: {
          select: {
            title: true,
            brand: true,
            websites: true,
            featureAssetId: true,
            featureImage: true,
          },
        },
      },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.asset.count(),
    getAutomationHealthSummary(),
    safeListCampaigns({ limit: 100 }),
    prisma.connectedAccount.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.publishedPost.findMany({
      where: {
        publishedAt: {
          gte: lastThirtyDays,
        },
      },
      include: {
        analyticsSnapshots: {
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { publishedAt: "desc" },
      take: 25,
    }),
    prisma.contentActionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const scheduleWithReadiness = scheduleRows.map((row) => ({
    ...row,
    readiness: getScheduleReadiness({
      channel: row.channel,
      platformAccount: row.platformAccount,
      brand: row.brand,
      approvedById: row.approvedById,
      content: row.content,
      blog: row.blog,
    }),
  }));

  const contentNeedsAttention = contentRows.filter((row) => (
    !row.brand
    || !row.tone
    || !row.targetAudience
    || (!row.primaryAssetId && !row.assetImage)
  ));

  const blogNeedsAttention = blogRows.filter((row) => !getBlogReadiness(row).ready);
  const readySchedule = scheduleWithReadiness.filter((row) => row.readiness.isReady);
  const scheduleNeedsAttention = scheduleWithReadiness.filter((row) => !row.readiness.isReady);
  const upcomingCampaigns = campaignsResponse.data.filter((campaign) => {
    if (!campaign.start_date) return false;
    const start = new Date(campaign.start_date);
    const end = campaign.end_date ? new Date(campaign.end_date) : start;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return end >= now && start <= nextTwoWeeks;
  });

  const channelMap = new Map<string, number>();
  const brandMap = new Map<string, BrandCoverage>();

  const ensureBrand = (brand: string | null | undefined) => {
    const resolvedBrand = labelOrUnknown(brand);
    const existing = brandMap.get(resolvedBrand);
    if (existing) return existing;
    const next = {
      brand: resolvedBrand,
      scheduled: 0,
      ready: 0,
      attention: 0,
      drafts: 0,
      blogs: 0,
      campaigns: 0,
    };
    brandMap.set(resolvedBrand, next);
    return next;
  };

  scheduleWithReadiness.forEach((row) => {
    addToMap(channelMap, row.channel);
    const brand = ensureBrand(row.brand ?? row.content?.brand ?? row.blog?.brand);
    brand.scheduled += 1;
    if (row.readiness.isReady) {
      brand.ready += 1;
    } else {
      brand.attention += 1;
    }
  });

  contentRows
    .filter((row) => row.status === ContentStatus.idea || row.status === ContentStatus.draft)
    .forEach((row) => {
      ensureBrand(row.brand).drafts += 1;
    });

  blogRows
    .filter((row) => row.status === BlogStatus.idea || row.status === BlogStatus.draft || row.status === BlogStatus.review)
    .forEach((row) => {
      ensureBrand(row.brand).blogs += 1;
    });

  upcomingCampaigns.forEach((campaign) => {
    if (campaign.brand.length === 0) {
      ensureBrand(null).campaigns += 1;
      return;
    }

    campaign.brand.forEach((brand) => {
      ensureBrand(brand).campaigns += 1;
    });
  });

  const activeConnectedAccounts = connectedAccounts.filter((account) => account.status === "active");
  const activePlatforms = new Set(activeConnectedAccounts.map((account) => account.platform));
  const engagementSnapshots = publishedPosts
    .map((post) => ({
      id: post.id,
      title: post.titleSnapshot || post.captionSnapshot || "Published post",
      platform: post.platform,
      engagementRate: post.analyticsSnapshots[0]?.engagementRate ?? null,
      publishedAt: post.publishedAt,
    }))
    .filter((post) => post.engagementRate !== null)
    .sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))
    .slice(0, 5);

  const strategyGaps = [
    contentNeedsAttention.length > 0
      ? {
          title: "Short-form records need metadata",
          detail: `${contentNeedsAttention.length} content record${contentNeedsAttention.length === 1 ? "" : "s"} missing brand, tone, audience, or assets.`,
          actionHref: "/content?queue=attention",
          actionLabel: "Open content queue",
        }
      : null,
    blogNeedsAttention.length > 0
      ? {
          title: "Blogs need editorial setup",
          detail: `${blogNeedsAttention.length} blog${blogNeedsAttention.length === 1 ? "" : "s"} missing brand, websites, or feature media.`,
          actionHref: "/blogs?queue=attention",
          actionLabel: "Open blog queue",
        }
      : null,
    scheduleNeedsAttention.length > 0
      ? {
          title: "Schedule entries are blocked",
          detail: `${scheduleNeedsAttention.length} upcoming schedule item${scheduleNeedsAttention.length === 1 ? "" : "s"} need approval, account routing, or linked creative.`,
          actionHref: "/schedule?queue=attention",
          actionLabel: "Open schedule queue",
        }
      : null,
    automationHealth.dueNow > 0
      ? {
          title: "Automations are due",
          detail: `${automationHealth.dueNow} workflow${automationHealth.dueNow === 1 ? "" : "s"} can run now to fill the plan.`,
          actionHref: "/automations",
          actionLabel: "Open automations",
        }
      : null,
    activePlatforms.size === 0
      ? {
          title: "Publishing channels are not live yet",
          detail: "Connected account records exist, but no active platform connection is ready for automated distribution.",
          actionHref: "/social-accounts",
          actionLabel: "Open social accounts",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const highestAttentionBrand = Array.from(brandMap.values())
    .sort((a, b) => b.attention - a.attention || b.campaigns - a.campaigns || b.drafts + b.blogs - (a.drafts + a.blogs))[0];

  const planningActions = [
    {
      title: "Build next week’s plan",
      detail: "Use current campaigns, draft queues, readiness blockers, and brand profiles to create a practical weekly plan.",
      prompt: "Build next week’s content plan. Use current campaigns, schedule readiness, draft queues, brand profiles, automation health, and performance signals. Create specific content/blog/schedule recommendations and tell me which records should be created or updated first.",
    },
    {
      title: "Fill calendar gaps",
      detail: "Ask Quill to turn empty or weak calendar coverage into draftable post ideas.",
      prompt: "Review the next 14 days of the content calendar and identify gaps by brand, channel, campaign, sport, and region. Recommend draft content or blog ideas to fill the highest-impact gaps.",
    },
    {
      title: "Create campaign launch plan",
      detail: "Turn active campaign windows into a launch sequence across short-form, blog, and schedule.",
      prompt: "Review active and upcoming campaigns and build a launch content plan. Include suggested social posts, blog support, asset needs, schedule timing, and approval blockers.",
    },
    {
      title: highestAttentionBrand
        ? `Fix ${highestAttentionBrand.brand} blockers`
        : "Fix readiness blockers",
      detail: highestAttentionBrand
        ? `${highestAttentionBrand.attention} upcoming schedule blocker${highestAttentionBrand.attention === 1 ? "" : "s"} and ${highestAttentionBrand.drafts + highestAttentionBrand.blogs} draft item${highestAttentionBrand.drafts + highestAttentionBrand.blogs === 1 ? "" : "s"} need operating attention.`
        : "Ask Quill to prioritize blocked records before publishing.",
      prompt: highestAttentionBrand
        ? `Prioritize content operations blockers for ${highestAttentionBrand.brand}. Review draft content, blogs, campaign windows, and upcoming schedule readiness. Recommend the fastest sequence of updates to get the next two weeks publishing-ready.`
        : "Prioritize content operations blockers across the next two weeks. Recommend the fastest sequence of updates to get the calendar publishing-ready.",
    },
  ];

  return {
    metrics: [
      {
        label: "Ready to publish",
        value: readySchedule.length,
        detail: "Upcoming items with approval, account routing, and linked creative",
      },
      {
        label: "Needs attention",
        value: contentNeedsAttention.length + blogNeedsAttention.length + scheduleNeedsAttention.length,
        detail: "Content, blog, and calendar records blocking automation",
      },
      {
        label: "Campaign windows",
        value: upcomingCampaigns.length,
        detail: campaignsResponse.ok ? "Active or upcoming in the next 14 days" : "Campaign API unavailable",
      },
      {
        label: "Assets available",
        value: assetCount,
        detail: "Synced media candidates for content packaging",
      },
    ],
    brandCoverage: Array.from(brandMap.values())
      .sort((a, b) => b.attention - a.attention || b.scheduled - a.scheduled || a.brand.localeCompare(b.brand))
      .slice(0, 8),
    channelLoad: topEntries(channelMap),
    strategyGaps,
    planningActions,
    upcomingSchedule: scheduleWithReadiness.slice(0, 8).map((row) => ({
      id: row.id,
      title: row.content?.title ?? row.blog?.title ?? "Untitled scheduled item",
      brand: row.brand ?? row.content?.brand ?? row.blog?.brand ?? null,
      channel: row.channel,
      scheduledFor: row.scheduledFor,
      status: row.status,
      isReady: row.readiness.isReady,
      reasons: row.readiness.reasons,
    })),
    performanceSignals: {
      activePlatforms: Array.from(activePlatforms) as SocialPlatform[],
      topPosts: engagementSnapshots,
      recentPublishedCount: publishedPosts.length,
    },
    automationHealth,
    campaigns: {
      ok: campaignsResponse.ok,
      error: campaignsResponse.error,
      upcoming: upcomingCampaigns.slice(0, 6),
    },
    recentActions,
  };
}
