import { ContentStatus, BlogStatus, ScheduleStatus } from "@prisma/client";
import { getAutomationHealthSummary } from "@/lib/automation/runner";
import { safeListCampaigns } from "@/lib/campaigns/client";
import { prisma } from "@/lib/prisma";

const thisWeekStart = new Date();
thisWeekStart.setHours(0, 0, 0, 0);

const thisWeekEnd = new Date(thisWeekStart);
thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);

function countByStatus<T extends string>(
  items: Array<{ status: T; _count: { status: number } }>,
  status: T,
) {
  return items.find((item) => item.status === status)?._count.status ?? 0;
}

export async function getDashboardSummary() {
  const [
    contentCounts,
    blogCounts,
    scheduleThisWeek,
    assetCount,
    brandProfileCount,
    contentNeedsAttention,
    blogNeedsAttention,
    readyScheduleCount,
    upcomingSchedule,
    recentActions,
    totalThreads,
    automationHealth,
    campaignsResponse,
  ] = await Promise.all([
    prisma.content.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.blog.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.contentSchedule.count({
      where: {
        scheduledFor: {
          gte: thisWeekStart,
          lt: thisWeekEnd,
        },
        status: {
          notIn: [ScheduleStatus.cancelled, ScheduleStatus.missed],
        },
      },
    }),
    prisma.asset.count(),
    prisma.brandProfile.count(),
    prisma.content.count({
      where: {
        OR: [
          { brand: null },
          { tone: null },
          { targetAudience: null },
          {
            AND: [{ primaryAssetId: null }, { assetImage: null }],
          },
        ],
      },
    }),
    prisma.blog.count({
      where: {
        OR: [
          { brand: null },
          {
            AND: [{ featureAssetId: null }, { featureImage: null }],
          },
          { websites: { isEmpty: true } },
        ],
      },
    }),
    prisma.contentSchedule.count({
      where: {
        status: ScheduleStatus.ready,
      },
    }),
    prisma.contentSchedule.findMany({
      include: {
        content: {
          select: { title: true },
        },
        blog: {
          select: { title: true },
        },
      },
      orderBy: { scheduledFor: "asc" },
      take: 6,
    }),
    prisma.contentActionLog.findMany({
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.chatThread.count(),
    getAutomationHealthSummary(),
    safeListCampaigns({ limit: 100 }),
  ]);

  const activeCampaignCount = campaignsResponse.data.filter(
    (campaign) => campaign.campaign_status === "active",
  ).length;

  return {
    metrics: [
      {
        label: "Content in Draft",
        value: countByStatus(contentCounts, ContentStatus.draft),
        detail: `${countByStatus(contentCounts, ContentStatus.approved)} approved`,
      },
      {
        label: "Blogs in Review",
        value: countByStatus(blogCounts, BlogStatus.review),
        detail: `${countByStatus(blogCounts, BlogStatus.published)} published`,
      },
      {
        label: "Scheduled This Week",
        value: scheduleThisWeek,
        detail: `${upcomingSchedule.filter((item) => item.status === ScheduleStatus.ready).length} ready`,
      },
      {
        label: "Active Campaigns",
        value: activeCampaignCount,
        detail: campaignsResponse.ok
          ? `${campaignsResponse.data.length} total campaigns`
          : "Campaign API unavailable",
      },
      {
        label: "Synced Assets",
        value: assetCount,
        detail: "WordPress-backed media library",
      },
      {
        label: "Brand Profiles",
        value: brandProfileCount,
        detail: "Shared AI and editorial guidance",
      },
      {
        label: "Active Chat Threads",
        value: totalThreads,
        detail: `${recentActions.filter((action) => action.source === "ai").length} recent AI actions`,
      },
      {
        label: "Active Automations",
        value: automationHealth.active,
        detail:
          automationHealth.dueNow > 0
            ? `${automationHealth.dueNow} due now`
            : automationHealth.nextDue
              ? `Next: ${automationHealth.nextDue.name}`
              : "No scheduled runs",
      },
    ],
    contentStatusBreakdown: Object.values(ContentStatus).map((status) => ({
      status,
      count: countByStatus(contentCounts, status),
    })),
    blogStatusBreakdown: Object.values(BlogStatus).map((status) => ({
      status,
      count: countByStatus(blogCounts, status),
    })),
    upcomingSchedule,
    recentActions,
    readiness: [
      {
        label: "Content needing metadata",
        value: contentNeedsAttention,
        detail: "Missing brand, targeting, or asset linkage",
      },
      {
        label: "Blogs needing editorial setup",
        value: blogNeedsAttention,
        detail: "Missing brand, websites, or feature media",
      },
      {
        label: "Schedule ready to publish",
        value: readyScheduleCount,
        detail: "Ready queue for future automation and publishing",
      },
    ],
    campaigns: {
      ok: campaignsResponse.ok,
      total: campaignsResponse.data.length,
      active: activeCampaignCount,
      error: campaignsResponse.error,
    },
    automations: automationHealth,
  };
}
