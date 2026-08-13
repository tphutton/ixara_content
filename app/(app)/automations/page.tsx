import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAutomationHealthSummary } from "@/lib/automation/runner";
import { prisma } from "@/lib/prisma";
import {
  runAutomationNowAction,
  runDueAutomationsAction,
  toggleAutomationStatusAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const [workflows, health] = await Promise.all([
    prisma.automationWorkflow.findMany({
      include: {
        brandProfile: {
          select: { brandName: true },
        },
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
    getAutomationHealthSummary(),
  ]);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Automations"
        description="Control recurring content generation and runner health without losing track of what is active."
        actions={
          <>
            <form action={runDueAutomationsAction}>
              <button className="button button--secondary" type="submit">
                Run due
              </button>
            </form>
            <Link className="button button--primary" href="/automations/new">
              Create automation
            </Link>
          </>
        }
      />

      <div className="stack">
        <section className="dashboard-mini-grid">
          <article className="dashboard-mini-metric">
            <h3>Total workflows</h3>
            <strong>{health.total}</strong>
          </article>
          <article className="dashboard-mini-metric">
            <h3>Active workflows</h3>
            <strong>{health.active}</strong>
          </article>
          <article className="dashboard-mini-metric">
            <h3>Due now</h3>
            <strong>{health.dueNow}</strong>
          </article>
          <article className="dashboard-mini-metric">
            <h3>Recent failures</h3>
            <strong>{health.failedRecently}</strong>
          </article>
        </section>

        {health.nextDue ? (
          <section className="quiet-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Next scheduled automation</p>
                <h3>{health.nextDue.name}</h3>
                <p className="muted">{format(health.nextDue.nextRunAt as Date, "PPP p")}</p>
              </div>
              <span className="inline-chip">{formatDistanceToNow(health.nextDue.nextRunAt as Date, { addSuffix: true })}</span>
            </div>
          </section>
        ) : null}

        <section className="quiet-panel">
          <div className="section-heading">
            <div>
              <p className="kicker">Workflows</p>
              <h3>Automation control</h3>
            </div>
            <span className="inline-chip">{workflows.length} configured</span>
          </div>

          {workflows.length === 0 ? (
            <div className="empty-state empty-state--quiet">
              <h3>No automations yet</h3>
              <p className="muted">Create your first workflow to define a repeatable content-generation routine.</p>
            </div>
          ) : (
            <div className="quiet-list">
              {workflows.map((workflow) => {
                const toggleAction = toggleAutomationStatusAction.bind(null, workflow.id);
                const runAction = runAutomationNowAction.bind(null, workflow.id);
                const latestRun = workflow.runs[0];

                return (
                  <article className="quiet-row automation-row" key={workflow.id}>
                    <div className="quiet-row__main">
                      <div className="quiet-row__title">
                        <Link href={`/automations/${workflow.id}`}>{workflow.name}</Link>
                        <StatusBadge label={workflow.status} />
                      </div>
                      <p className="muted">{workflow.description ?? "No description"}</p>
                      <div className="quiet-meta">
                        <span>{workflow.type}</span>
                        <span>{workflow.brandProfile?.brandName ?? workflow.brandName ?? "No brand"}</span>
                        <span>
                          {workflow.nextRunAt
                            ? `Next ${format(workflow.nextRunAt, "MMM d, p")}`
                            : "Manual only"}
                        </span>
                        <span>
                          {latestRun
                            ? `Last ${latestRun.status} ${formatDistanceToNow(latestRun.startedAt, { addSuffix: true })}`
                            : "Never run"}
                        </span>
                      </div>
                    </div>
                    <div className="row-actions">
                      <form action={runAction}>
                        <button className="button button--secondary" type="submit">Run</button>
                      </form>
                      <form action={toggleAction}>
                        <button className="button button--secondary" type="submit">
                          {workflow.status === "active" ? "Pause" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
          </div>
    </section>
  );
}
