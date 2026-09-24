import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { ConnectedAccountForm } from "@/components/social/connected-account-form";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { SummaryStats } from "@/components/ui/summary-stats";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { isMetaConfigured, isMetaPlatform } from "@/lib/social/meta";
import {
  createConnectedAccountAction,
  deleteConnectedAccountAction,
  disconnectConnectedAccountAction,
  syncConnectedAccountNowAction,
  updateConnectedAccountAction,
} from "./actions";

export const dynamic = "force-dynamic";

type SocialAccountsPageProps = {
  searchParams?: Promise<{
    error?: string;
    success?: string;
    new?: string;
    edit?: string;
    view?: string;
  }>;
};

function tokenExpiresWithinDays(tokenExpiresAt: Date | null, days: number) {
  return tokenExpiresAt
    ? tokenExpiresAt.getTime() <= Date.now() + days * 24 * 60 * 60 * 1000
    : false;
}

export default async function SocialAccountsPage({ searchParams }: SocialAccountsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
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
  const metaConfigured = isMetaConfigured();
  const creatingAccount = resolvedSearchParams?.new === "1";
  const editingAccount = accounts.find((account) => account.id === resolvedSearchParams?.edit) ?? null;
  const viewingAccount = accounts.find((account) => account.id === resolvedSearchParams?.view) ?? null;

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Social Accounts"
        description="Connect the accounts that power live analytics now and publishing next."
        actions={
          <Link className="button button--primary" href="/social-accounts?new=1">
            Add account
          </Link>
        }
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

      {resolvedSearchParams?.success ? (
        <div className="card card--padded">
          <strong>Connection updated</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            {resolvedSearchParams.success === "meta_connected"
              ? "Meta account connected successfully. You can sync posts and analytics now."
              : resolvedSearchParams.success === "account_created"
                ? "Account saved. Connect it to Meta to authorize sync and publishing permissions."
              : resolvedSearchParams.success === "account_updated"
                ? "Account updated."
              : resolvedSearchParams.success === "account_synced"
                ? "Account synced. Published posts and analytics are now refreshed."
              : resolvedSearchParams.success === "account_disconnected"
                ? "Account disconnected."
              : resolvedSearchParams.success === "account_deleted"
                ? "Account deleted."
              : resolvedSearchParams.success}
          </p>
        </div>
      ) : null}

      {resolvedSearchParams?.error ? (
        <div className="card card--padded">
          <strong>Connection issue</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            {resolvedSearchParams.error}
          </p>
        </div>
      ) : null}

      <section className="quiet-panel">
        <div className="section-heading">
          <div>
            <p className="kicker">Connection readiness</p>
            <h3>{metaConfigured ? "Meta is ready to connect" : "Meta credentials needed"}</h3>
            <p className="muted">
              {metaConfigured
                ? "Facebook and Instagram accounts can be authorized, synced, and monitored from this page."
                : "Add the Meta environment variables before connecting Facebook or Instagram accounts."}
            </p>
          </div>
          <Link className="button button--secondary" href="/analytics">
            Analytics
          </Link>
        </div>
      </section>

      {accounts.length === 0 ? (
          <div className="empty-state empty-state--quiet">
            <h3>No accounts yet</h3>
            <p className="muted">
              Add the first social account record to start preparing for live publishing and
              analytics sync.
            </p>
          </div>
        ) : (
          <div className="table-shell">
            <table className="table social-account-table">
              <thead>
                <tr><th>Account</th><th>Platform</th><th>Brand & market</th><th>Status</th><th>Activity</th><th>Last sync</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
            {accounts.map((account) => {
              const syncAction = syncConnectedAccountNowAction.bind(null, account.id);
              const canUseMetaFlow = metaConfigured && isMetaPlatform(account.platform);
              const expiresSoon = tokenExpiresWithinDays(account.tokenExpiresAt, 14);

              return (
                <tr key={account.id}>
                  <td><Link href={`/social-accounts?view=${account.id}`}><strong>{account.accountName}</strong></Link><div className="table-subtext">{account.accountHandle ?? "No handle"}</div></td>
                  <td>{account.platform}</td>
                  <td><strong>{account.brandProfile?.brandName ?? account.brandName ?? "No brand"}</strong><div className="table-subtext">{[account.region, account.country].filter(Boolean).join(", ") || "No market set"}</div></td>
                  <td><StatusBadge label={account.status} />{expiresSoon ? <div className="table-subtext">Authorization expires soon</div> : null}</td>
                  <td><strong>{account.publishedPosts.length} post{account.publishedPosts.length === 1 ? "" : "s"}</strong><div className="table-subtext">Updated {formatDistanceToNow(account.updatedAt, { addSuffix: true })}</div></td>
                  <td>{account.lastSyncedAt ? formatDistanceToNow(account.lastSyncedAt, { addSuffix: true }) : "Never"}<div className="table-subtext">{account.lastSyncStatus ?? "No sync result"}</div></td>
                  <td><div className="row-actions table-actions">
                    {canUseMetaFlow && !account.encryptedAccessToken ? (
                      <Link className="button button--primary" href={`/api/social/meta/start?accountId=${account.id}`}>
                        Connect Meta
                      </Link>
                    ) : null}
                    {canUseMetaFlow && account.encryptedAccessToken ? (
                      <form action={syncAction}>
                        <button className="button button--primary" type="submit">Sync posts</button>
                      </form>
                    ) : null}
                    <Link className="button button--secondary" href={`/social-accounts?view=${account.id}`}>
                      View
                    </Link>
                  </div></td>
                </tr>
              );
            })}
              </tbody>
            </table>
          </div>
        )}

      {viewingAccount ? (() => {
        const canUseMetaFlow = metaConfigured && isMetaPlatform(viewingAccount.platform);
        const expiresSoon = tokenExpiresWithinDays(viewingAccount.tokenExpiresAt, 14);
        const needsReconnect = viewingAccount.status === "needs_reauth" || viewingAccount.status === "error" || expiresSoon;
        const disconnectAction = disconnectConnectedAccountAction.bind(null, viewingAccount.id);
        const deleteAction = deleteConnectedAccountAction.bind(null, viewingAccount.id);
        const syncAction = syncConnectedAccountNowAction.bind(null, viewingAccount.id);
        return <div className="editor-overlay editor-overlay--dialog">
          <div className="editor-overlay__backdrop"><Link aria-label="Close account details" href="/social-accounts" /></div>
          <section className="editor-overlay__panel account-detail-panel">
            <div className="editor-overlay__header"><div><p className="kicker">Social account</p><h3>{viewingAccount.accountName}</h3><div className="toolbar__group"><StatusBadge label={viewingAccount.status} /><span className="inline-chip">{viewingAccount.platform}</span></div></div><Link className="button button--secondary" href="/social-accounts">Close</Link></div>
            <div className="editor-overlay__content stack">
              <div className="metadata-grid"><div><span>Handle</span><strong>{viewingAccount.accountHandle ?? "Not set"}</strong></div><div><span>Brand</span><strong>{viewingAccount.brandProfile?.brandName ?? viewingAccount.brandName ?? "Not set"}</strong></div><div><span>Market</span><strong>{[viewingAccount.region, viewingAccount.country].filter(Boolean).join(", ") || "Not set"}</strong></div><div><span>Published posts</span><strong>{viewingAccount.publishedPosts.length}</strong></div></div>
              <div><p className="kicker">Connection</p><p><strong>External account ID:</strong> {viewingAccount.externalAccountId ?? "Not connected"}</p><p><strong>Permissions:</strong> {viewingAccount.scopes.join(", ") || "None recorded"}</p><p><strong>Authorization:</strong> {viewingAccount.tokenExpiresAt ? `${expiresSoon ? "Expires soon, " : "Expires "}${formatDistanceToNow(viewingAccount.tokenExpiresAt, { addSuffix: true })}` : "No expiry recorded"}</p></div>
              <div><p className="kicker">Latest sync</p><p>{viewingAccount.lastSyncStatus ?? "This account has not reported a sync result."}</p><p className="muted">{viewingAccount.lastSyncedAt ? `Synced ${formatDistanceToNow(viewingAccount.lastSyncedAt, { addSuffix: true })}` : "Never synced"}</p></div>
            </div>
            <div className="editor-overlay__footer form-actions">
              <Link className="button button--primary" href={`/social-accounts?edit=${viewingAccount.id}`}>Edit account</Link>
              {canUseMetaFlow && !viewingAccount.encryptedAccessToken ? <Link className="button button--secondary" href={`/api/social/meta/start?accountId=${viewingAccount.id}`}>Connect Meta</Link> : null}
              {canUseMetaFlow && viewingAccount.encryptedAccessToken ? <form action={syncAction}><button className="button button--secondary" type="submit">Sync posts</button></form> : null}
              {canUseMetaFlow && viewingAccount.encryptedAccessToken && needsReconnect ? <Link className="button button--secondary" href={`/api/social/meta/start?accountId=${viewingAccount.id}`}>Reconnect Meta</Link> : null}
              <form action={disconnectAction}><button className="button button--secondary" type="submit">Disconnect</button></form>
              <form action={deleteAction}><button className="button button--secondary" type="submit">Delete</button></form>
            </div>
          </section>
        </div>;
      })() : null}

      {creatingAccount ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close account form" href="/social-accounts" />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">New account</p>
                <h3>Prepare a social connection</h3>
              </div>
              <Link className="button button--secondary" href="/social-accounts">Close</Link>
            </div>
            <div className="editor-overlay__content">
              <ConnectedAccountForm action={createConnectedAccountAction} brandProfiles={brandProfiles} />
            </div>
          </div>
        </div>
      ) : null}

      {editingAccount ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close account editor" href="/social-accounts" />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Edit account</p>
                <h3>{editingAccount.accountName}</h3>
              </div>
              <Link className="button button--secondary" href="/social-accounts">Close</Link>
            </div>
            <div className="editor-overlay__content">
              <ConnectedAccountForm
                account={editingAccount}
                action={updateConnectedAccountAction.bind(null, editingAccount.id)}
                brandProfiles={brandProfiles}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
