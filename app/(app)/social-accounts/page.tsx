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
  }>;
};

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

      <section className="quiet-panel">
        <div className="section-heading">
          <div>
          <p className="kicker">Registered accounts</p>
            <h3>Live account control</h3>
          </div>
          <span className="inline-chip">{accounts.length} total</span>
        </div>

        {accounts.length === 0 ? (
          <div className="empty-state empty-state--quiet">
            <h3>No accounts yet</h3>
            <p className="muted">
              Add the first social account record to start preparing for live publishing and
              analytics sync.
            </p>
          </div>
        ) : (
          <div className="quiet-list">
            {accounts.map((account) => {
              const disconnectAction = disconnectConnectedAccountAction.bind(null, account.id);
              const syncAction = syncConnectedAccountNowAction.bind(null, account.id);
              const canUseMetaFlow = metaConfigured && isMetaPlatform(account.platform);

              return (
                <article className="quiet-row social-account-row" key={account.id}>
                  <div className="quiet-row__main">
                    <div className="quiet-row__title">
                      <strong>{account.accountName}</strong>
                      <StatusBadge label={account.status} />
                    </div>
                    <div className="quiet-meta">
                      <span>{account.platform}</span>
                      <span>{account.brandProfile?.brandName ?? account.brandName ?? "No brand"}</span>
                      <span>{account.publishedPosts.length} post{account.publishedPosts.length === 1 ? "" : "s"}</span>
                      <span>Updated {formatDistanceToNow(account.updatedAt, { addSuffix: true })}</span>
                    </div>
                    {account.lastSyncStatus ? (
                      <p className="muted">{account.lastSyncStatus}</p>
                    ) : null}
                  </div>

                  <div className="row-actions">
                    {canUseMetaFlow ? (
                      <Link className="button button--primary" href={`/api/social/meta/start?accountId=${account.id}`}>
                        Connect
                      </Link>
                    ) : null}
                    {canUseMetaFlow && account.encryptedAccessToken ? (
                      <form action={syncAction}>
                        <button className="button button--secondary" type="submit">Sync</button>
                      </form>
                    ) : null}
                    <Link className="button button--secondary" href={`/social-accounts?edit=${account.id}`}>
                      Edit
                    </Link>
                    <form action={disconnectAction}>
                      <button className="button button--secondary" type="submit">Disconnect</button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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
