import { ApprovalStatus, UserRole } from "@prisma/client";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAdminUserAccess } from "@/lib/auth/user-access";
import { prisma } from "@/lib/prisma";
import { updateUserAccessAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminApprovalsPage() {
  const currentAdmin = await requireAdminUserAccess();
  const users = await prisma.userAccess.findMany({
    orderBy: [
      { approvalStatus: "asc" },
      { createdAt: "desc" },
    ],
  });

  const pendingUsers = users.filter((user) => user.approvalStatus === ApprovalStatus.pending);
  const reviewedUsers = users.filter((user) => user.approvalStatus !== ApprovalStatus.pending);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Admin Approvals"
        description="Manual approval and role assignment workspace for internal access control."
      />

      <div className="admin-approval-grid">
        <section className="quiet-panel">
          <div className="section-heading">
            <div>
              <p className="kicker">Pending queue</p>
              <h3>{pendingUsers.length} request{pendingUsers.length === 1 ? "" : "s"}</h3>
            </div>
          </div>
          {pendingUsers.length === 0 ? (
            <div className="empty-state empty-state--quiet">
              <h3>No pending approvals</h3>
              <p className="muted">New Clerk signups will appear here automatically after their first authenticated request.</p>
            </div>
          ) : (
            <div className="quiet-list">
              {pendingUsers.map((user) => (
                <article className="quiet-row" key={user.id}>
                  <div className="quiet-row__main">
                    <div className="quiet-row__title">
                      <strong>{user.fullName ?? "Unnamed user"}</strong>
                      <StatusBadge label={user.approvalStatus} />
                    </div>
                    <p className="muted">{user.email}</p>
                  </div>

                  <form action={updateUserAccessAction} className="admin-access-form">
                    <input name="userId" type="hidden" value={user.id} />
                    <select defaultValue={user.role} name="role" aria-label={`Role for ${user.email}`}>
                      {Object.values(UserRole).map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <div>
                      <button className="button button--primary" name="approvalStatus" type="submit" value={ApprovalStatus.approved}>
                        Approve
                      </button>
                      <button className="button button--secondary" name="approvalStatus" type="submit" value={ApprovalStatus.rejected}>
                        Reject
                      </button>
                    </div>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="stack">
          <section className="quiet-panel">
            <p className="kicker">Current admin session</p>
            <h3>{currentAdmin.fullName ?? currentAdmin.email}</h3>
            <p className="muted">
              {currentAdmin.email} • {currentAdmin.role}
            </p>
          </section>

          <section className="quiet-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Reviewed users</p>
                <h3>{reviewedUsers.length} account{reviewedUsers.length === 1 ? "" : "s"}</h3>
              </div>
            </div>
            <div className="quiet-list">
              {reviewedUsers.length === 0 ? (
                <p className="muted">No reviewed users yet.</p>
              ) : (
                reviewedUsers.map((user) => (
                  <article className="quiet-row quiet-row--compact" key={user.id}>
                    <div className="quiet-row__main">
                      <div className="quiet-row__title">
                        <strong>{user.fullName ?? "Unnamed user"}</strong>
                        <StatusBadge label={user.approvalStatus} />
                      </div>
                      <p className="muted">
                        {user.email} • {user.role}
                      </p>
                    </div>

                    <form action={updateUserAccessAction} className="admin-access-form admin-access-form--compact">
                      <input name="userId" type="hidden" value={user.id} />
                      <select defaultValue={user.role} name="role" aria-label={`Role for ${user.email}`}>
                        {Object.values(UserRole).map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <div>
                        <button className="button button--secondary" name="approvalStatus" type="submit" value={ApprovalStatus.approved}>
                          Approve
                        </button>
                        <button className="button button--secondary" name="approvalStatus" type="submit" value={ApprovalStatus.rejected}>
                          Reject
                        </button>
                      </div>
                    </form>
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
