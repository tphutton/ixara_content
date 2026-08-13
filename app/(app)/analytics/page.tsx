import Link from "next/link";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { PublishedPostForm } from "@/components/analytics/published-post-form";
import { SummaryStats } from "@/components/ui/summary-stats";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { createImportedPublishedPostAction } from "./actions";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  searchParams?: Promise<{ import?: string }>;
};

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
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
        description="Performance memory for Quill: synced posts, winning patterns, and historical benchmarks."
        actions={
          <>
            <Link className="button button--secondary" href="/social-accounts">
              Social accounts
            </Link>
            <Link className="button button--primary" href="/analytics?import=1">
              Import post
            </Link>
          </>
        }
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

      <section className="dashboard-command-grid">
        <article className="quiet-panel dashboard-command-grid__main">
          <div className="section-heading">
            <div>
              <p className="kicker">Top performers</p>
              <h3>Best posts by engagement rate</h3>
            </div>
            <span className="inline-chip">{topPerformers.length} ranked</span>
          </div>
          <div className="quiet-list">
            {topPerformers.length === 0 ? (
              <div className="empty-state empty-state--quiet">
                <h3>No analytics snapshots yet</h3>
                <p className="muted">Import past post metrics or sync connected accounts to seed this view.</p>
              </div>
            ) : (
              topPerformers.map(({ post, snapshot }) => (
                <div className="quiet-row" key={post.id}>
                  <div className="quiet-row__main">
                    <div className="quiet-row__title">
                      <strong>{post.titleSnapshot ?? post.content?.title ?? post.blog?.title ?? "Untitled post"}</strong>
                      <StatusBadge label={post.status} />
                    </div>
                    <div className="quiet-meta">
                      <span>{post.platform}</span>
                      <span>{post.connectedAccount?.accountName ?? post.platformAccountName ?? "No account"}</span>
                      <span>{snapshot?.engagements ?? 0} engagements</span>
                      <span>{snapshot?.impressions ?? 0} impressions</span>
                    </div>
                  </div>
                  <div className="quiet-row__aside">
                    <strong>{formatPercent(snapshot?.engagementRate ?? null)}</strong>
                    <span className="muted">ER</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <aside className="quiet-panel">
          <div>
            <p className="kicker">Learning loop</p>
            <h3>What this powers</h3>
            <p className="muted">
              These records feed planner recommendations, best-time analysis, channel mix decisions,
              and future campaign pattern matching.
            </p>
          </div>
          <div className="quick-action-grid">
            <Link className="quick-action" href="/planner">Planner</Link>
            <Link className="quick-action" href="/plans">Plans</Link>
            <Link className="quick-action" href="/social-accounts">Accounts</Link>
            <Link className="quick-action" href="/chat">Ask Quill</Link>
          </div>
        </aside>
      </section>

      <section className="quiet-panel">
        <div className="section-heading">
          <div>
            <p className="kicker">Published history</p>
            <h3>Recent post records</h3>
          </div>
          <span className="inline-chip">{posts.length} records</span>
        </div>

        {posts.length === 0 ? (
          <div className="empty-state empty-state--quiet">
            <h3>No published posts yet</h3>
            <p className="muted">
              Add imported records or connect live social accounts so performance data can start
              feeding the workspace.
            </p>
          </div>
        ) : (
          <div className="table-shell">
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
      </section>

      {resolvedSearchParams?.import === "1" ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close import form" href="/analytics" />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Import history</p>
                <h3>Add a past post with metrics</h3>
              </div>
              <Link className="button button--secondary" href="/analytics">Close</Link>
            </div>
            <div className="editor-overlay__content">
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
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
