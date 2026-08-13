import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { SummaryStats } from "@/components/ui/summary-stats";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboardSummary } from "@/lib/dashboard/summary";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Dashboard"
        description="A calm operating overview for planning, quality, publishing readiness, and live content signals."
        actions={
          <>
            <Link className="button button--secondary" href="/planner">
              Planner
            </Link>
            <Link className="button button--primary" href="/chat">
              Ask Quill
            </Link>
          </>
        }
      />

      <SummaryStats items={summary.metrics} />

      <section className="dashboard-command-grid">
        <article className="quiet-panel dashboard-command-grid__main">
          <div className="section-heading">
            <div>
              <p className="kicker">Today first</p>
              <h3>Upcoming schedule</h3>
            </div>
            <Link className="button button--secondary" href="/schedule">
              Calendar
            </Link>
          </div>
          <div className="quiet-list">
            {summary.upcomingSchedule.length === 0 ? (
              <div className="empty-state empty-state--quiet">
                <h3>No upcoming scheduled content</h3>
                <p className="muted">Create a schedule entry to populate the editorial calendar.</p>
              </div>
            ) : (
              summary.upcomingSchedule.slice(0, 6).map((item) => (
                <Link key={item.id} className="quiet-row quiet-row--link" href={`/schedule/${item.id}`}>
                  <div className="quiet-row__main">
                    <div className="quiet-row__title">
                      <strong>{item.content?.title ?? item.blog?.title ?? "Untitled link"}</strong>
                      <StatusBadge label={item.status} />
                    </div>
                    <div className="quiet-meta">
                      <span>{format(item.scheduledFor, "EEE, MMM d, p")}</span>
                      <span>{item.channel ?? "Unassigned channel"}</span>
                      <span>{item.brand ?? "No brand"}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </article>

        <aside className="quiet-panel">
          <div className="section-heading">
            <div>
              <p className="kicker">Recent</p>
              <h3>Activity</h3>
            </div>
          </div>
          <div className="quiet-list">
            {summary.recentActions.length === 0 ? (
              <div className="empty-state empty-state--quiet">
                <h3>No actions yet</h3>
                <p className="muted">Manual and AI-assisted mutations will appear here after records change.</p>
              </div>
            ) : (
              summary.recentActions.slice(0, 6).map((action) => (
                <article key={action.id} className="quiet-row dashboard-activity-row">
                  <div className="quiet-row__main">
                    <strong>{action.summary}</strong>
                    <div className="quiet-meta">
                      <span>{action.user.fullName ?? action.user.email}</span>
                      <span>{formatDistanceToNow(action.createdAt, { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="quiet-row__aside">
                    <span className="inline-chip">{action.source}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>

      <section className="dashboard-command-grid">
        <article className="quiet-panel">
          <div className="section-heading">
            <div>
              <p className="kicker">Editorial</p>
              <h3>Status breakdown</h3>
            </div>
            <div className="toolbar__group">
              <Link className="button button--secondary" href="/content">Content</Link>
              <Link className="button button--secondary" href="/blogs">Blogs</Link>
            </div>
          </div>
          <div className="dashboard-breakdown dashboard-breakdown--quiet">
            <div>
              <p className="kicker">Content statuses</p>
              <div className="stack">
                {summary.contentStatusBreakdown.map((item) => (
                  <div className="status-row" key={item.status}>
                    <StatusBadge label={item.status} />
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="kicker">Blog statuses</p>
              <div className="stack">
                {summary.blogStatusBreakdown.map((item) => (
                  <div className="status-row" key={item.status}>
                    <StatusBadge label={item.status} />
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="quiet-panel">
          <div className="section-heading">
            <div>
              <p className="kicker">Readiness</p>
              <h3>Publishing gates</h3>
            </div>
            <Link className="button button--secondary" href="/quality">
              Quality
            </Link>
          </div>
          <div className="dashboard-mini-grid">
            {summary.readiness.map((item) => (
              <div className="dashboard-mini-metric" key={item.label}>
                <h3>{item.label}</h3>
                <strong>{item.value}</strong>
                <p className="muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-command-grid">
        <article className="quiet-panel">
          <div className="section-heading">
            <div>
              <p className="kicker">Automation</p>
              <h3>Health</h3>
            </div>
            <Link className="button button--secondary" href="/automations">
              Manage
            </Link>
          </div>
          <div className="dashboard-mini-grid">
            <div className="dashboard-mini-metric">
              <h3>Active workflows</h3>
              <strong>{summary.automations.active}</strong>
              <p className="muted">{summary.automations.total} total configured workflows</p>
            </div>
            <div className="dashboard-mini-metric">
              <h3>Due now</h3>
              <strong>{summary.automations.dueNow}</strong>
              <p className="muted">Ready for safe runner execution</p>
            </div>
            <div className="dashboard-mini-metric">
              <h3>Recent failures</h3>
              <strong>{summary.automations.failedRecently}</strong>
              <p className="muted">Failed runs in the last 7 days</p>
            </div>
            <div className="dashboard-mini-metric">
              <h3>Next due</h3>
              <strong>{summary.automations.nextDue ? format(summary.automations.nextDue.nextRunAt as Date, "MMM d") : "—"}</strong>
              <p className="muted">
                {summary.automations.nextDue
                  ? `${summary.automations.nextDue.name} • ${format(summary.automations.nextDue.nextRunAt as Date, "p")}`
                  : "No upcoming scheduled run"}
              </p>
            </div>
          </div>
        </article>

        <article className="quiet-panel">
          <div>
            <p className="kicker">Next actions</p>
            <h3>Common paths</h3>
          </div>
          <div className="quick-action-grid">
            <Link className="quick-action" href="/content/new">Create content</Link>
            <Link className="quick-action" href="/blogs/new">Create blog</Link>
            <Link className="quick-action" href="/plans">Open plans</Link>
            <Link className="quick-action" href="/assets">Assets</Link>
            <Link className="quick-action" href="/campaigns">Campaigns</Link>
            <Link className="quick-action" href="/social-accounts">Social</Link>
          </div>
        </article>
      </section>

      <section className="quiet-panel">
        <div className="section-heading">
          <div>
            <p className="kicker">Campaign service</p>
            <h3>{summary.campaigns.ok ? "Connected" : "Needs attention"}</h3>
            <p className="muted">
              {summary.campaigns.ok
                ? `${summary.campaigns.active} active campaigns out of ${summary.campaigns.total} total campaign records.`
                : summary.campaigns.error ?? "Campaign API is unavailable."}
            </p>
          </div>
          <StatusBadge label={summary.campaigns.ok ? "active" : "warning"} />
        </div>
      </section>
    </section>
  );
}
