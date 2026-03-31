import { formatDistanceToNow } from "date-fns";
import { ConnectedAccountForm } from "@/components/social/connected-account-form";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { SummaryStats } from "@/components/ui/summary-stats";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import {
  createConnectedAccountAction,
  disconnectConnectedAccountAction,
  updateConnectedAccountAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function SocialAccountsPage() {
  const [brandProfiles, accounts] = await Promise.all([
    prisma.brandProfile.findMany({
      select: { id: true, brandName: true },
      orderBy: { brandName: "asc" },
    }),
    prisma.connectedAccount.findMany({
      include: {
        brandProfile: { select: { brandName: true } },
        publishedPosts: { select: { id: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
  ]);

  const activeCount = accounts.filter((account) => account.status === "active").length;
  const pendingCount = accounts.filter((account) => account.status === "pending_setup").length;
  const needsAttentionCount = accounts.filter((account) =>
    account.status === "needs_reauth" || account.status === "error",
  ).length;

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Social Accounts"
        description="Register and manage social accounts that will later power live publishing and analytics sync."
      />

      <SummaryStats
        items={[
          {
            label: "Registered accounts",
            value: accounts.length,
            detail: "Social accounts and imports available to the workspace",
          },
          {
            label: "Active",
            value: activeCount,
            detail: "Ready for live sync once OAuth is connected",
          },
          {
            label: "Pending setup",
            value: pendingCount,
            detail: "Account records created but not fully authorized",
          },
          {
            label: "Needs attention",
            value: needsAttentionCount,
            detail: "Accounts that need reauth or sync follow-up",
          },
        ]}
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <article className="card card--padded">
          <p className="kicker">Add account</p>
          <h3 style={{ marginTop: 0 }}>Prepare a social connection</h3>
          <p className="muted">
            Start by registering the account and platform details here. OAuth tokens and live sync
            will be layered on top once platform apps are connected.
          </p>
          <ConnectedAccountForm
            action={createConnectedAccountAction}
            brandProfiles={brandProfiles}
          />
        </article>

        <article className="card card--padded">
          <p className="kicker">Connection model</p>
          <h3 style={{ marginTop: 0 }}>How live sync will work</h3>
          <div className="stack" style={{ gap: 16 }}>
            <div>
              <strong>1. Register the account</strong>
              <p className="muted" style={{ marginBottom: 0 }}>
                Keep platform, brand, region, and account identifiers in one place before live auth
                is attached.
              </p>
            </div>
            <div>
              <strong>2. Connect OAuth later</strong>
              <p className="muted" style={{ marginBottom: 0 }}>
                When Meta or another provider is ready, these records become the destination for
                account IDs, scopes, and encrypted tokens.
              </p>
            </div>
            <div>
              <strong>3. Sync published posts and analytics</strong>
              <p className="muted" style={{ marginBottom: 0 }}>
                Synced data will populate the analytics workspace so Quill can learn from what
                actually performed well.
              </p>
            </div>
          </div>
        </article>
      </div>

      <div className="stack">
        <div>
          <p className="kicker">Registered accounts</p>
          <h3 style={{ marginTop: 0 }}>Existing social account records</h3>
        </div>

        {accounts.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No accounts yet</h3>
            <p className="muted">
              Add the first social account record to start preparing for live publishing and
              analytics sync.
            </p>
          </div>
        ) : (
          <div className="stack">
            {accounts.map((account) => {
              const updateAction = updateConnectedAccountAction.bind(null, account.id);
              const disconnectAction = disconnectConnectedAccountAction.bind(null, account.id);

              return (
                <article className="card card--padded" key={account.id}>
                  <div className="section-heading" style={{ marginBottom: 20 }}>
                    <div>
                      <h3 style={{ marginTop: 0, marginBottom: 6 }}>{account.accountName}</h3>
                      <p className="muted" style={{ margin: 0 }}>
                        {account.platform} • {account.brandProfile?.brandName ?? account.brandName ?? "No brand"}
                      </p>
                    </div>
                    <div className="toolbar__group">
                      <StatusBadge label={account.status} />
                      <span className="inline-chip">
                        {account.publishedPosts.length} post{account.publishedPosts.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div className="stack" style={{ gap: 10, marginBottom: 20 }}>
                    <p className="muted" style={{ margin: 0 }}>
                      Last updated {formatDistanceToNow(account.updatedAt, { addSuffix: true })}
                    </p>
                    <p className="muted" style={{ margin: 0 }}>
                      Scopes: {account.scopes.length > 0 ? account.scopes.join(", ") : "Not set"}
                    </p>
                    {account.lastSyncStatus ? (
                      <p className="muted" style={{ margin: 0 }}>
                        Notes: {account.lastSyncStatus}
                      </p>
                    ) : null}
                  </div>

                  <ConnectedAccountForm
                    account={account}
                    action={updateAction}
                    brandProfiles={brandProfiles}
                  />

                  <div style={{ marginTop: 16 }}>
                    <form action={disconnectAction}>
                      <button className="button button--secondary" type="submit">
                        Mark disconnected
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
