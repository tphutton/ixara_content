import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { PublishedPostForm } from "@/components/analytics/published-post-form";
import { SummaryStats } from "@/components/ui/summary-stats";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { createImportedPublishedPostAction } from "./actions";

export const dynamic = "force-dynamic";

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

export default async function AnalyticsPage() {
  const [connectedAccounts, contentOptions, blogOptions, scheduleOptions, posts] = await Promise.all([
    prisma.connectedAccount.findMany({
      select: {
        id: true,
        accountName: true,
        platform: true,
      },
      orderBy: { accountName: "asc" },
    }),
    prisma.content.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.blog.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.contentSchedule.findMany({
      select: {
        id: true,
        content: { select: { title: true } },
        blog: { select: { title: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.publishedPost.findMany({
      include: {
        connectedAccount: {
          select: { accountName: true },
        },
        content: {
          select: { title: true },
        },
        blog: {
          select: { title: true },
        },
        analyticsSnapshots: {
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);

  const importedCount = posts.filter((post) => post.status === "imported").length;
  const latestSnapshots = posts
    .map((post) => ({
      post,
      snapshot: post.analyticsSnapshots[0] ?? null,
    }))
    .filter((item) => item.snapshot !== null);
  const topPerformers = [...latestSnapshots]
    .sort((a, b) => (b.snapshot?.engagementRate ?? -1) - (a.snapshot?.engagementRate ?? -1))
    .slice(0, 5);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Analytics"
        description="Store published post history and performance data so Quill can learn from what succeeded and what underperformed."
      />

      <SummaryStats
        items={[
          {
            label: "Published posts",
            value: posts.length,
            detail: "Imported or synced post history available for analysis",
          },
          {
            label: "Imported records",
            value: importedCount,
            detail: "Historic posts manually added before live sync is connected",
          },
          {
            label: "Connected accounts",
            value: connectedAccounts.length,
            detail: "Accounts ready to be linked to future live publishing and analytics",
          },
          {
            label: "Posts with metrics",
            value: latestSnapshots.length,
            detail: "Published posts already carrying performance snapshots",
          },
        ]}
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <article className="card card--padded">
          <p className="kicker">Import history</p>
          <h3 style={{ marginTop: 0 }}>Add a past post with metrics</h3>
          <p className="muted">
            Use this to seed historical winners and underperformers before live platform sync is in
            place.
          </p>
          <PublishedPostForm
            action={createImportedPublishedPostAction}
            blogOptions={blogOptions}
            connectedAccounts={connectedAccounts}
            contentOptions={contentOptions}
            scheduleOptions={scheduleOptions.map((item) => ({
              id: item.id,
              title: item.content?.title ?? item.blog?.title ?? "Untitled schedule",
            }))}
          />
        </article>

        <article className="card card--padded">
          <p className="kicker">Top performers</p>
          <h3 style={{ marginTop: 0 }}>Best posts by engagement rate</h3>
          <div className="stack">
            {topPerformers.length === 0 ? (
              <p className="muted">No analytics snapshots yet. Import past post metrics to seed this view.</p>
            ) : (
              topPerformers.map(({ post, snapshot }) => (
                <div className="card card--padded" key={post.id}>
                  <div className="section-heading">
                    <div>
                      <strong>{post.titleSnapshot ?? post.content?.title ?? post.blog?.title ?? "Untitled post"}</strong>
                      <p className="muted" style={{ margin: "8px 0 0" }}>
                        {post.platform} • {post.connectedAccount?.accountName ?? post.platformAccountName ?? "No account"}
                      </p>
                    </div>
                    <StatusBadge label={post.status} />
                  </div>
                  <div className="toolbar" style={{ marginTop: 14 }}>
                    <span className="inline-chip">ER {formatPercent(snapshot?.engagementRate ?? null)}</span>
                    <span className="inline-chip">{snapshot?.engagements ?? 0} engagements</span>
                    <span className="inline-chip">{snapshot?.impressions ?? 0} impressions</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <div className="stack">
        <div>
          <p className="kicker">Published history</p>
          <h3 style={{ marginTop: 0 }}>Recent post records</h3>
        </div>

        {posts.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No published posts yet</h3>
            <p className="muted">
              Add imported records or connect live social accounts so performance data can start
              feeding the workspace.
            </p>
          </div>
        ) : (
          <div className="card table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Platform</th>
                  <th>Account</th>
                  <th>Published</th>
                  <th>Engagement Rate</th>
                  <th>Engagements</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const snapshot = post.analyticsSnapshots[0] ?? null;
                  return (
                    <tr key={post.id}>
                      <td>
                        <strong>{post.titleSnapshot ?? post.content?.title ?? post.blog?.title ?? "Untitled post"}</strong>
                      </td>
                      <td>{post.platform}</td>
                      <td>{post.connectedAccount?.accountName ?? post.platformAccountName ?? "—"}</td>
                      <td>{post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "—"}</td>
                      <td>{formatPercent(snapshot?.engagementRate ?? null)}</td>
                      <td>{snapshot?.engagements ?? "—"}</td>
                      <td>
                        <StatusBadge label={post.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
