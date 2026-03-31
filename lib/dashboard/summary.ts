import { ContentStatus, BlogStatus, ScheduleStatus } from "@prisma/client";
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
    upcomingSchedule,
    recentActions,
    totalThreads,
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
  ]);

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
        label: "Active Chat Threads",
        value: totalThreads,
        detail: `${recentActions.filter((action) => action.source === "ai").length} recent AI actions`,
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
  };
}
