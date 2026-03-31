import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { notFound } from "next/navigation";
import { AutomationForm } from "@/components/automations/automation-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import {
  deleteAutomationAction,
  runAutomationNowAction,
  toggleAutomationStatusAction,
  updateAutomationAction,
} from "../actions";

export const dynamic = "force-dynamic";

type AutomationDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AutomationDetailPage({ params }: AutomationDetailPageProps) {
  const { id } = await params;
  const [workflow, brandProfiles, runs] = await Promise.all([
    prisma.automationWorkflow.findUnique({
      where: { id },
      include: {
        brandProfile: {
          select: { brandName: true },
        },
      },
    }),
    prisma.brandProfile.findMany({
      select: { id: true, brandName: true },
      orderBy: { brandName: "asc" },
    }),
    prisma.automationRun.findMany({
      where: { workflowId: id },
      include: {
        triggeredBy: {
          select: { fullName: true, email: true },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  if (!workflow) {
    notFound();
  }

  const updateAction = updateAutomationAction.bind(null, id);
  const deleteAction = deleteAutomationAction.bind(null, id);
  const runAction = runAutomationNowAction.bind(null, id);
  const toggleAction = toggleAutomationStatusAction.bind(null, id);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title={workflow.name}
        description="Manage workflow cadence, generation rules, and run history for this automation."
      />

      <div className="grid" style={{ gridTemplateColumns: "1.1fr 0.9fr", alignItems: "start" }}>
        <div className="stack">
          <Link className="button button--secondary" href="/automations">
            Back to automations
          </Link>
          <div className="card card--padded">
            <AutomationForm
              action={updateAction}
              brandProfiles={brandProfiles}
              workflow={workflow}
            />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <form action={runAction}>
              <SubmitButton label="Run now" pendingLabel="Running..." />
            </form>
            <form action={toggleAction}>
              <SubmitButton
                label={workflow.status === "active" ? "Pause automation" : "Activate automation"}
                pendingLabel="Saving..."
                variant="secondary"
              />
            </form>
            <form action={deleteAction}>
              <SubmitButton
                label="Delete automation"
                pendingLabel="Deleting..."
                variant="secondary"
              />
            </form>
          </div>
        </div>

        <div className="stack">
          <article className="card card--padded">
            <p className="kicker">Automation state</p>
            <h3 style={{ marginTop: 0 }}>{workflow.name}</h3>
            <div className="stack" style={{ gap: 10 }}>
              <span className="inline-chip">Type: {workflow.type}</span>
              <span className="inline-chip">Status: {workflow.status}</span>
              <span className="inline-chip">Frequency: {workflow.frequency}</span>
              <span className="inline-chip">
                Brand: {workflow.brandProfile?.brandName ?? workflow.brandName ?? "—"}
              </span>
              <span className="inline-chip">
                Next run: {workflow.nextRunAt ? format(workflow.nextRunAt, "PPP p") : "Manual only"}
              </span>
            </div>
          </article>

          <article className="card card--padded">
            <p className="kicker">Recent runs</p>
            <h3 style={{ marginTop: 0 }}>Execution history</h3>
            <div className="stack">
              {runs.length === 0 ? (
                <p className="muted">This automation has not run yet.</p>
              ) : (
                runs.map((run) => (
                  <div className="card card--padded" key={run.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <strong>{run.summary ?? "Run completed"}</strong>
                      <StatusBadge label={run.status} />
                    </div>
                    <p className="muted" style={{ margin: "8px 0 0" }}>
                      {format(run.startedAt, "PPP p")} •{" "}
                      {run.triggeredBy?.fullName ?? run.triggeredBy?.email ?? "System"}
                    </p>
                    {run.errorMessage ? (
                      <p className="muted" style={{ margin: "8px 0 0" }}>
                        {run.errorMessage}
                      </p>
                    ) : null}
                    {run.output && typeof run.output === "object" ? (
                      <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                        {Array.isArray((run.output as { titles?: string[] }).titles) ? (
                          <div>
                            <p className="muted" style={{ margin: 0 }}>
                              Generated titles
                            </p>
                            <div className="stack" style={{ gap: 6, marginTop: 6 }}>
                              {((run.output as { titles?: string[] }).titles ?? []).map((title) => (
                                <span className="inline-chip" key={title}>
                                  {title}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <span className="inline-chip" style={{ marginTop: 10 }}>
                      {formatDistanceToNow(run.startedAt, { addSuffix: true })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
