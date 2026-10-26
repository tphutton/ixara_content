import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { PublishingCalendar } from "@/components/schedule/publishing-calendar";
import ScheduleTablePage from "@/components/schedule/schedule-table-page";
import { safeListCampaigns } from "@/lib/campaigns/client";
import { publishedPostBrand } from "@/lib/social/reporting";
import {
  combineCalendarEntries,
  safeMediaUrl,
  type CalendarEntry,
} from "@/lib/schedule/calendar";

export const dynamic = "force-dynamic";
type Props = {
  searchParams?: Promise<{
    view?: string;
    month?: string;
    week?: string;
    brand?: string;
    period?: string;
    queue?: string;
    platform?: string;
    status?: string;
  }>;
};
export default async function SchedulePage(props: Props) {
  const search = props.searchParams ? await props.searchParams : {};
  if (search.view === "table") return <ScheduleTablePage {...props} />;
  const [slots, posts, campaignsResult, contentOptions] = await Promise.all([
    prisma.contentSchedule.findMany({
      include: {
        content: { include: { primaryAsset: true } },
        blog: true,
        publishedPosts: { select: { id: true } },
      },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.publishedPost.findMany({
      where: {
        status: { in: ["published", "imported"] },
        publishedAt: { not: null },
      },
      include: {
        content: true,
        blog: true,
        schedule: true,
        connectedAccount: {
          select: {
            accountName: true,
            externalAccountId: true,
            brandName: true,
            brandProfile: { select: { brandName: true } },
          },
        },
        analyticsSnapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
      },
      orderBy: { publishedAt: "desc" },
    }),
    safeListCampaigns({ limit: 100 }),
    prisma.content.findMany({
      select: { id: true, title: true, brand: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const planned: CalendarEntry[] = slots.map((s) => ({
    id: s.id,
    updatedAt: s.updatedAt.toISOString(),
    movable:
      !["published", "cancelled"].includes(s.status) &&
      s.publishedPosts.length === 0,
    kind: "schedule",
    title: s.content?.title ?? s.blog?.title ?? "Untitled schedule",
    date: s.scheduledFor.toISOString(),
    status: s.status,
    brand: s.brand ?? s.content?.brand ?? s.blog?.brand ?? "Unassigned",
    platform: s.channel ?? "Unassigned",
    account: s.platformAccount ?? "",
    caption: s.content?.body ?? s.blog?.text1 ?? "",
    campaign: s.campaignName,
    contentId: s.contentId,
    contentTitle: s.content?.title ?? null,
    scheduleId: s.id,
    mediaUrl: safeMediaUrl(
      s.content?.primaryAsset?.fileUrl ??
        s.content?.assetImage ??
        s.blog?.featureImage,
    ),
    thumbnail: safeMediaUrl(s.content?.assetImage ?? s.blog?.featureImage),
    externalUrl: null,
    metrics: null,
    syncedAt: null,
    notes: s.notes,
  }));
  const published: CalendarEntry[] = posts.map((p) => {
    const media = p.mediaSnapshot as {
      url?: string;
      thumbnail?: string;
    } | null;
    const metrics = p.analyticsSnapshots[0];
    return {
      id: p.id,
      kind: "published",
      title:
        p.titleSnapshot ??
        p.content?.title ??
        p.blog?.title ??
        `${p.platform} post`,
      date: p.publishedAt!.toISOString(),
      status: "published",
      brand: publishedPostBrand(p) ?? "Unassigned",
      platform: p.platform,
      account: p.platformAccountName ?? p.connectedAccount?.accountName ?? "",
      caption: p.captionSnapshot ?? "",
      campaign: p.schedule?.campaignName ?? p.content?.campaignName ?? null,
      contentId: p.contentId,
      contentTitle: p.content?.title ?? null,
      scheduleId: p.scheduleId,
      mediaUrl: safeMediaUrl(media?.url),
      thumbnail: safeMediaUrl(media?.thumbnail),
      externalUrl: safeMediaUrl(p.externalPostUrl),
      metrics: metrics
        ? {
            Views: metrics.views,
            Reach: metrics.reach,
            Impressions: metrics.impressions,
            Engagements: metrics.engagements,
            Likes: metrics.likes,
            Comments: metrics.comments,
            Shares: metrics.shares,
            Saves: metrics.saves,
            Clicks: metrics.clicks,
            "Engagement rate (%)": metrics.engagementRate,
          }
        : null,
      syncedAt:
        metrics?.capturedAt.toISOString() ??
        p.latestAnalyticsAt?.toISOString() ??
        null,
      notes: p.schedule?.notes ?? null,
    };
  });
  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Publishing calendar"
        description="Plan content, review published posts and track their performance. All times Asia/Bangkok."
        actions={
          <>
            <Link
              className="button button--secondary"
              href="/schedule?view=table"
            >
              Manage table
            </Link>
            <Link className="button button--primary" href="/schedule/new">
              Create entry
            </Link>
          </>
        }
      />
      {!campaignsResult.ok && (
        <p role="status" className="muted">
          Campaigns unavailable. Your calendar posts are still shown.
        </p>
      )}
      <PublishingCalendar
        entries={combineCalendarEntries(planned, published)}
        campaigns={
          campaignsResult.ok
            ? campaignsResult.data.map((c) => ({
                id: c.campaign_id,
                title: c.campaign_name,
                start: c.start_date,
                end: c.end_date,
                brands: c.brand,
                status: c.campaign_status,
              }))
            : []
        }
        contentOptions={contentOptions}
        initialBrand={search.brand}
        initialMonth={search.month}
        initialWeek={search.week}
        initialView={search.view}
        initialPlatform={search.platform}
        initialStatus={search.status}
      />
    </section>
  );
}
