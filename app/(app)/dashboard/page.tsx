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

        <section className="card card--padded content-block content-block--wide">
          <h3>Publishing Readiness</h3>
          <div className="dashboard-breakdown" style={{ marginTop: 18 }}>
            {summary.readiness.map((item) => (
              <article className="card card--padded metric-card" key={item.label}>
                <h3>{item.label}</h3>
                <strong>{item.value}</strong>
                <p className="muted" style={{ margin: "10px 0 0" }}>
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="card card--padded content-block content-block--wide">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
            <h3>Automation Health</h3>
            <Link className="button button--secondary" href="/automations">
              Open Automations
            </Link>
          </div>
          <div className="dashboard-breakdown" style={{ marginTop: 18 }}>
            <article className="card card--padded metric-card">
              <h3>Active workflows</h3>
              <strong>{summary.automations.active}</strong>
              <p className="muted" style={{ margin: "10px 0 0" }}>
                {summary.automations.total} total configured workflows
              </p>
            </article>
            <article className="card card--padded metric-card">
              <h3>Due now</h3>
              <strong>{summary.automations.dueNow}</strong>
              <p className="muted" style={{ margin: "10px 0 0" }}>
                Ready for safe runner execution
              </p>
            </article>
            <article className="card card--padded metric-card">
              <h3>Recent failures</h3>
              <strong>{summary.automations.failedRecently}</strong>
              <p className="muted" style={{ margin: "10px 0 0" }}>
                Failed runs in the last 7 days
              </p>
            </article>
            <article className="card card--padded metric-card">
              <h3>Next due</h3>
              <strong>{summary.automations.nextDue ? format(summary.automations.nextDue.nextRunAt as Date, "MMM d") : "—"}</strong>
              <p className="muted" style={{ margin: "10px 0 0" }}>
                {summary.automations.nextDue
                  ? `${summary.automations.nextDue.name} • ${format(summary.automations.nextDue.nextRunAt as Date, "p")}`
                  : "No upcoming scheduled run"}
              </p>
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
            <Link className="card card--padded" href="/assets">
              <strong>Open assets</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Sync WordPress media and attach reusable creative across content and campaigns.
              </p>
            </Link>
            <Link className="card card--padded" href="/campaigns">
              <strong>View campaigns</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Manage voucher sales and promotional campaigns from the main data API.
              </p>
            </Link>
            <Link className="card card--padded" href="/settings">
              <strong>Manage brand profiles</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Store tone, audience, region, and CTA rules for the editorial workspace.
              </p>
            </Link>
            <Link className="card card--padded" href="/automations">
              <strong>Control automations</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Define and run repeatable social and blog-generation workflows.
              </p>
            </Link>
            <Link className="card card--padded" href="/social-accounts">
              <strong>Manage social accounts</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Prepare connected account records for future live publishing and analytics sync.
              </p>
            </Link>
            <Link className="card card--padded" href="/analytics">
              <strong>Review analytics</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Import past posts and performance data so Quill can learn from results.
              </p>
            </Link>
          </div>
        </section>

        <section className="card card--padded content-block content-block--wide">
          <h3>Campaign Service Status</h3>
          <div className="stack" style={{ marginTop: 18 }}>
            <div className="card card--padded">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <strong>{summary.campaigns.ok ? "Campaign API connected" : "Campaign API needs attention"}</strong>
                  <p className="muted" style={{ margin: "8px 0 0" }}>
                    {summary.campaigns.ok
                      ? `${summary.campaigns.active} active campaigns out of ${summary.campaigns.total} total campaign records.`
                      : summary.campaigns.error ?? "Campaign API is unavailable."}
                  </p>
                </div>
                <StatusBadge label={summary.campaigns.ok ? "active" : "warning"} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
