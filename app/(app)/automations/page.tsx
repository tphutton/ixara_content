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
        description="Control recurring editorial workflows for social content, blog generation, and the next layer of automation-ready publishing operations."
      />

      <div className="stack">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="button button--primary" href="/automations/new">
            Create automation
          </Link>
          <form action={runDueAutomationsAction}>
            <button className="button button--secondary" type="submit">
              Run due automations
            </button>
          </form>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <article className="card card--padded">
            <h3>Total workflows</h3>
            <strong>{health.total}</strong>
          </article>
          <article className="card card--padded">
            <h3>Active workflows</h3>
            <strong>{health.active}</strong>
          </article>
          <article className="card card--padded">
            <h3>Due now</h3>
            <strong>{health.dueNow}</strong>
          </article>
          <article className="card card--padded">
            <h3>Recent failures</h3>
            <strong>{health.failedRecently}</strong>
          </article>
        </div>

        {health.nextDue ? (
          <div className="card card--padded">
            <strong>Next scheduled automation</strong>
            <p className="muted" style={{ margin: "8px 0 0" }}>
              {health.nextDue.name} • {format(health.nextDue.nextRunAt as Date, "PPP p")}
            </p>
          </div>
        ) : null}

        {workflows.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No automations yet</h3>
            <p className="muted">
              Create your first workflow to define a repeatable content-generation routine.
            </p>
          </div>
        ) : (
          <div className="card table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Brand</th>
                  <th>Next run</th>
                  <th>Last run</th>
                  <th>Status</th>
                  <th>Controls</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((workflow) => {
                  const toggleAction = toggleAutomationStatusAction.bind(null, workflow.id);
                  const runAction = runAutomationNowAction.bind(null, workflow.id);
                  const latestRun = workflow.runs[0];

                  return (
                    <tr key={workflow.id}>
                      <td>
                        <div className="stack" style={{ gap: 6 }}>
                          <Link href={`/automations/${workflow.id}`}>{workflow.name}</Link>
                          <span className="muted">
                            {workflow.description ?? "No description"}
                          </span>
                        </div>
                      </td>
                      <td>{workflow.type}</td>
                      <td>{workflow.brandProfile?.brandName ?? workflow.brandName ?? "—"}</td>
                      <td>
                        {workflow.nextRunAt
                          ? `${format(workflow.nextRunAt, "PPP p")} (${formatDistanceToNow(workflow.nextRunAt, { addSuffix: true })})`
                          : "Manual only"}
                      </td>
                      <td>
                        {latestRun
                          ? `${latestRun.status} ${formatDistanceToNow(latestRun.startedAt, { addSuffix: true })}`
                          : "Never"}
                      </td>
                      <td>
                        <StatusBadge label={workflow.status} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <form action={runAction}>
                            <button className="button button--secondary" type="submit">
                              Run now
                            </button>
                          </form>
                          <form action={toggleAction}>
                            <button className="button button--secondary" type="submit">
                              {workflow.status === "active" ? "Pause" : "Activate"}
                            </button>
                          </form>
                        </div>
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
