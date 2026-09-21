import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { QuillActionStatus, UserRole } from "@prisma/client";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { prisma } from "@/lib/prisma";
import { approveQuillAction, rejectQuillAction } from "./actions";

export const dynamic = "force-dynamic";

function argumentHighlights(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const hidden = new Set(["accessToken", "token", "secret", "password"]);
  return Object.entries(value)
    .filter(([key, item]) => !hidden.has(key) && ["string", "number", "boolean"].includes(typeof item))
    .slice(0, 8)
    .map(([key, item]) => ({ label: key.replace(/([A-Z])/g, " $1"), value: String(item) }));
}

export default async function QuillActionsPage() {
  const access = await requireApprovedUserAccess();
  const canApprove = access.role !== UserRole.viewer;
  const proposals = await prisma.quillActionProposal.findMany({
    where: { userId: access.id },
    include: { thread: { select: { title: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  const open = proposals.filter((item) =>
    item.status === QuillActionStatus.pending || item.status === QuillActionStatus.failed,
  );
  const history = proposals.filter((item) => !open.some((candidate) => candidate.id === item.id));

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="AI Actions"
        description="Review every workspace or external change Quill has proposed across your conversations."
        actions={<Link className="button button--secondary" href="/chat">Open Quill</Link>}
      />

      <section className="quiet-panel">
        <div className="section-heading">
          <div>
            <p className="kicker">Needs a decision</p>
            <h3>{open.length} open action{open.length === 1 ? "" : "s"}</h3>
          </div>
          <span className="inline-chip">{proposals.length} total</span>
        </div>

        {open.length === 0 ? (
          <div className="empty-state empty-state--quiet">
            <h3>No actions waiting</h3>
            <p className="muted">Quill proposals will appear here before any data or external service is changed.</p>
          </div>
        ) : (
          <div className="quiet-list">
            {open.map((proposal) => {
              const approve = approveQuillAction.bind(null, proposal.id);
              const reject = rejectQuillAction.bind(null, proposal.id);
              return (
                <article className="quiet-row quill-queue-row" key={proposal.id}>
                  <div className="quiet-row__main">
                    <div className="quiet-row__title">
                      <strong>{proposal.summary}</strong>
                      <StatusBadge label={proposal.status} />
                    </div>
                    <div className="quiet-meta">
                      <span>{proposal.toolName}</span>
                      <Link href={`/chat?thread=${proposal.threadId}`}>{proposal.thread.title}</Link>
                      <span>{formatDistanceToNow(proposal.createdAt, { addSuffix: true })}</span>
                    </div>
                    {argumentHighlights(proposal.arguments).length > 0 ? (
                      <dl className="quill-action-card__details">
                        {argumentHighlights(proposal.arguments).map((item) => (
                          <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                        ))}
                      </dl>
                    ) : null}
                    {proposal.error ? <div className="form-error">{proposal.error}</div> : null}
                  </div>
                  <div className="row-actions">
                    <form action={reject}><SubmitButton label="Reject" pendingLabel="Rejecting..." variant="secondary" /></form>
                    {canApprove ? (
                      <form action={approve}>
                        <SubmitButton label={proposal.status === "failed" ? "Retry" : "Approve"} pendingLabel="Running..." />
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="quiet-panel">
        <div className="section-heading">
          <div><p className="kicker">History</p><h3>Recent decisions</h3></div>
        </div>
        <div className="table-shell">
          <table className="table">
            <thead><tr><th>Action</th><th>Thread</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={4} className="muted">No reviewed actions yet.</td></tr>
              ) : history.slice(0, 50).map((proposal) => (
                <tr key={proposal.id}>
                  <td><strong>{proposal.summary}</strong><div className="muted">{proposal.toolName}</div></td>
                  <td><Link href={`/chat?thread=${proposal.threadId}`}>{proposal.thread.title}</Link></td>
                  <td><StatusBadge label={proposal.status} /></td>
                  <td>{formatDistanceToNow(proposal.createdAt, { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
