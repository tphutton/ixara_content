import { EditorialApprovalDecision, type EditorialApprovalTargetType } from "@prisma/client";
import { decideEditorialApprovalAction, requestEditorialApprovalAction, revokeEditorialApprovalAction } from "@/app/(app)/editorial-approvals/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getEditorialApprovalHistory } from "@/lib/approvals/editorial-approvals";

type EditorialApprovalPanelProps = {
  targetType: EditorialApprovalTargetType;
  targetId: string;
  path: string;
  compact?: boolean;
};

function person(person: { fullName: string | null; email: string }) {
  return person.fullName ?? person.email;
}

export async function EditorialApprovalPanel({ targetType, targetId, path, compact = false }: EditorialApprovalPanelProps) {
  const history = await getEditorialApprovalHistory({ type: targetType, id: targetId });
  const latest = history[0] ?? null;
  const pending = history.find((entry) => entry.decision === EditorialApprovalDecision.pending) ?? null;
  const requestAction = requestEditorialApprovalAction.bind(null, targetType, targetId, path);
  const decisionAction = pending ? decideEditorialApprovalAction.bind(null, pending.id, path) : null;
  const revokeAction = revokeEditorialApprovalAction.bind(null, targetType, targetId, path);

  return (
    <section className={`quiet-panel editorial-approval${compact ? " editorial-approval--compact" : ""}`}>
      <div className="section-heading">
        <div><p className="kicker">Editorial approval</p><h3>{pending ? "Decision required" : latest?.decision === "approved" ? "Approved" : "Ready for review"}</h3></div>
        <StatusBadge label={pending?.decision ?? latest?.decision ?? "not_requested"} />
      </div>

      {pending && decisionAction ? (
        <form action={decisionAction} className="quiet-form editorial-approval__decision">
          <p className="muted">Requested by {person(pending.requestedBy)} {pending.requestComment ? `· ${pending.requestComment}` : ""}</p>
          <label className="field"><span className="field__label">Decision note</span><input name="comment" placeholder="Optional approval note or requested changes" /></label>
          <div className="form-actions">
            <SubmitButton label="Request changes" name="decision" pendingLabel="Saving..." value="changes_requested" variant="secondary" />
            <SubmitButton label="Reject" name="decision" pendingLabel="Saving..." value="rejected" variant="secondary" />
            <SubmitButton label="Approve" name="decision" pendingLabel="Checking..." value="approved" />
          </div>
        </form>
      ) : (
        <div className="quiet-form editorial-approval__request">
          {latest ? <p className="muted">Latest: {latest.decision.replaceAll("_", " ")}{latest.decidedBy ? ` by ${person(latest.decidedBy)}` : ""}{latest.decisionComment ? ` · ${latest.decisionComment}` : ""}</p> : <p className="muted">Submit this record for a readiness and quality-gated editorial decision.</p>}
          <form action={requestAction} className="quiet-form"><label className="field"><span className="field__label">Review note</span><input name="comment" placeholder="What should the reviewer check?" /></label><div className="form-actions"><SubmitButton label={latest?.decision === "approved" ? "Request reapproval" : "Request approval"} pendingLabel="Requesting..." /></div></form>
          {latest?.decision === "approved" ? <form action={revokeAction} className="form-actions"><SubmitButton label="Revoke approval" pendingLabel="Revoking..." variant="secondary" /></form> : null}
        </div>
      )}

      {history.length > 1 ? <details className="approval-history"><summary>Decision history ({history.length})</summary><div className="quiet-list">{history.map((entry) => <div className="quiet-row" key={entry.id}><div><strong>{entry.decision.replaceAll("_", " ")}</strong><div className="table-subtext">{new Date(entry.createdAt).toLocaleString()} · requested by {person(entry.requestedBy)}</div></div>{entry.decisionComment ? <span className="muted">{entry.decisionComment}</span> : null}</div>)}</div></details> : null}
    </section>
  );
}
