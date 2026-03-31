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

      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", alignItems: "start" }}>
        <section className="card card--padded">
          <p className="kicker">Pending queue</p>
          {pendingUsers.length === 0 ? (
            <div className="empty-state card card--padded">
              <h3>No pending approvals</h3>
              <p className="muted">New Clerk signups will appear here automatically after their first authenticated request.</p>
            </div>
          ) : (
            <div className="stack">
              {pendingUsers.map((user) => (
                <article className="card card--padded" key={user.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <div>
                      <strong>{user.fullName ?? "Unnamed user"}</strong>
                      <p className="muted" style={{ margin: "8px 0 0" }}>
                        {user.email}
                      </p>
                    </div>
                    <StatusBadge label={user.approvalStatus} />
                  </div>

                  <form action={updateUserAccessAction} className="stack" style={{ marginTop: 18 }}>
                    <input name="userId" type="hidden" value={user.id} />

                    <label className="stack" style={{ gap: 8 }}>
                      <span className="muted">Role</span>
                      <select
                        defaultValue={user.role}
                        name="role"
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid rgba(15, 23, 42, 0.12)",
                          background: "white",
                        }}
                      >
                        {Object.values(UserRole).map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <button className="button button--primary" name="approvalStatus" type="submit" value={ApprovalStatus.approved}>
                        Approve user
                      </button>
                      <button className="button button--secondary" name="approvalStatus" type="submit" value={ApprovalStatus.rejected}>
                        Reject user
                      </button>
                    </div>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="stack">
          <section className="card card--padded">
            <p className="kicker">Current admin session</p>
            <h3>{currentAdmin.fullName ?? currentAdmin.email}</h3>
            <p className="muted">
              {currentAdmin.email} • {currentAdmin.role}
            </p>
          </section>

          <section className="card card--padded">
            <p className="kicker">Reviewed users</p>
            <div className="stack">
              {reviewedUsers.length === 0 ? (
                <p className="muted">No reviewed users yet.</p>
              ) : (
                reviewedUsers.map((user) => (
                  <article className="card card--padded" key={user.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <strong>{user.fullName ?? "Unnamed user"}</strong>
                        <p className="muted" style={{ margin: "8px 0 0" }}>
                          {user.email}
                        </p>
                      </div>
                      <StatusBadge label={user.approvalStatus} />
                    </div>
                    <p className="muted" style={{ margin: "12px 0 0" }}>
                      Current role: {user.role}
                    </p>

                    <form action={updateUserAccessAction} className="stack" style={{ marginTop: 16 }}>
                      <input name="userId" type="hidden" value={user.id} />

                      <label className="stack" style={{ gap: 8 }}>
                        <span className="muted">Role</span>
                        <select
                          defaultValue={user.role}
                          name="role"
                          style={{
                            padding: "12px 14px",
                            borderRadius: 12,
                            border: "1px solid rgba(15, 23, 42, 0.12)",
                            background: "white",
                          }}
                        >
                          {Object.values(UserRole).map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <button className="button button--primary" name="approvalStatus" type="submit" value={ApprovalStatus.approved}>
                          Save as approved
                        </button>
                        <button className="button button--secondary" name="approvalStatus" type="submit" value={ApprovalStatus.rejected}>
                          Mark rejected
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
