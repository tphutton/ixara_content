import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { dashboardMetrics, recentActions, scheduleRows } from "@/lib/data/placeholders";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function DashboardPage() {
  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Dashboard"
        description="Track editorial throughput, upcoming schedule load, and recent assistant activity."
      />

      <div className="grid dashboard-grid">
        {dashboardMetrics.map((metric) => (
          <article className="card card--padded metric-card" key={metric.label}>
            <h3>{metric.label}</h3>
            <strong>{metric.value}</strong>
          </article>
        ))}

        <section className="card card--padded content-block content-block--wide">
          <h3>Upcoming Scheduled Content</h3>
          <div className="stack" style={{ marginTop: 18 }}>
            {scheduleRows.map((item) => (
              <div key={`${item.item}-${item.scheduledFor}`} className="card card--padded">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <strong>{item.item}</strong>
                    <p className="muted" style={{ margin: "8px 0 0" }}>
                      {item.channel} • {item.scheduledFor} • {item.brand}
                    </p>
                  </div>
                  <StatusBadge label={item.status} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card card--padded content-block content-block--narrow">
          <h3>Recent AI Actions</h3>
          <div className="stack" style={{ marginTop: 18 }}>
            {recentActions.map((action) => (
              <article key={action.action} className="card card--padded">
                <strong>{action.action}</strong>
                <p className="muted" style={{ margin: "8px 0" }}>
                  {action.detail}
                </p>
                <span className="inline-chip">{action.time}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
