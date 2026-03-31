import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboardSummary } from "@/lib/dashboard/summary";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Dashboard"
        description="Track editorial throughput, upcoming schedule load, and recent assistant activity."
      />

      <div className="grid dashboard-grid">
        {summary.metrics.map((metric) => (
          <article className="card card--padded metric-card" key={metric.label}>
            <h3>{metric.label}</h3>
            <strong>{metric.value}</strong>
            <p className="muted" style={{ margin: "10px 0 0" }}>
              {metric.detail}
            </p>
          </article>
        ))}

        <section className="card card--padded content-block content-block--wide">
          <h3>Upcoming Scheduled Content</h3>
          <div className="stack" style={{ marginTop: 18 }}>
            {summary.upcomingSchedule.length === 0 ? (
              <div className="card card--padded empty-state">
                <h3>No upcoming scheduled content</h3>
                <p className="muted">Create a schedule entry to populate the editorial calendar.</p>
              </div>
            ) : (
              summary.upcomingSchedule.map((item) => (
                <div key={item.id} className="card card--padded">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <strong>{item.content?.title ?? item.blog?.title ?? "Untitled link"}</strong>
                      <p className="muted" style={{ margin: "8px 0 0" }}>
                        {item.channel ?? "Unassigned channel"} • {format(item.scheduledFor, "PPP p")} • {item.brand ?? "No brand"}
                      </p>
                    </div>
                    <StatusBadge label={item.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card card--padded content-block content-block--narrow">
          <h3>Recent Activity</h3>
          <div className="stack" style={{ marginTop: 18 }}>
            {summary.recentActions.length === 0 ? (
              <div className="card card--padded empty-state">
                <h3>No actions yet</h3>
                <p className="muted">Manual and AI-assisted mutations will appear here after records change.</p>
              </div>
            ) : (
              summary.recentActions.map((action) => (
                <article key={action.id} className="card card--padded">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong>{action.summary}</strong>
                    <span className="inline-chip">{action.source}</span>
                  </div>
                  <p className="muted" style={{ margin: "8px 0" }}>
                    {action.user.fullName ?? action.user.email}
                  </p>
                  <span className="inline-chip">
                    {formatDistanceToNow(action.createdAt, { addSuffix: true })}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="card card--padded content-block content-block--wide">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
            <h3>Editorial Status Breakdown</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="button button--secondary" href="/content">
                Open Content
              </Link>
              <Link className="button button--secondary" href="/blogs">
                Open Blogs
              </Link>
              <Link className="button button--secondary" href="/schedule">
                Open Schedule
              </Link>
            </div>
          </div>

          <div className="dashboard-breakdown">
            <article className="card card--padded">
              <p className="kicker">Content statuses</p>
              <div className="stack">
                {summary.contentStatusBreakdown.map((item) => (
                  <div className="status-row" key={item.status}>
                    <StatusBadge label={item.status} />
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="card card--padded">
              <p className="kicker">Blog statuses</p>
              <div className="stack">
                {summary.blogStatusBreakdown.map((item) => (
                  <div className="status-row" key={item.status}>
                    <StatusBadge label={item.status} />
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="card card--padded content-block content-block--narrow">
          <h3>Quick Links</h3>
          <div className="stack" style={{ marginTop: 18 }}>
            <Link className="card card--padded" href="/content/new">
              <strong>Create content</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Add a short-form or campaign content unit.
              </p>
            </Link>
            <Link className="card card--padded" href="/blogs/new">
              <strong>Create blog</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Draft a structured editorial article with up to 8 sections.
              </p>
            </Link>
            <Link className="card card--padded" href="/chat">
              <strong>Ask the assistant</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Use AI tools to list, create, update, and summarize records.
              </p>
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
