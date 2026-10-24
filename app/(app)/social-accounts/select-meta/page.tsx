import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireEditorialUserAccess } from "@/lib/auth/user-access";
import { readMetaSelection, eligibleMetaPages } from "@/lib/social/meta-selection";
import { confirmMetaSelection } from "./actions";

export const dynamic = "force-dynamic";
export default async function SelectMetaPage({ searchParams }: { searchParams: Promise<{ accountId?: string }> }) {
  const access = await requireEditorialUserAccess();
  const { accountId } = await searchParams;
  const account = accountId ? await prisma.connectedAccount.findUnique({ where: { id: accountId } }) : null;
  let saved: ReturnType<typeof readMetaSelection> | null = null;
  let error = "Account not found. Return to Social Accounts and start Connect Meta again.";
  if (account) {
    try {
      const metadata = account.metadata as Record<string, Prisma.JsonValue> | null;
      saved = readMetaSelection(metadata?.pendingMetaConnection, account.id, access.id);
    } catch (e) { error = e instanceof Error ? e.message : "Account selection is unavailable."; }
  }
  if (!account || !saved) return <section className="page-shell"><h1>Choose Meta account</h1><p>{error}</p><Link className="button button--secondary" href="/social-accounts">Back to Social Accounts</Link></section>;
  const choices = eligibleMetaPages(account.platform, saved.pages);
  // Only render public identity fields. Tokens stay in server-only encrypted metadata.
  return <section className="page-shell">
    <h1>Choose the account to connect</h1>
    <p>Connecting <strong>{account.accountName}</strong> on {account.platform}. Select the actual identity you want Content to use.</p>
    <p className="muted">Existing authorization stays in place until you confirm. Previously imported posts are retained; changing the connection does not delete them.</p>
    <form action={confirmMetaSelection.bind(null, account.id, saved.id)} className="stack">
      <fieldset className="stack"><legend>Authorized accounts</legend>
        {choices.map(item => <label className="card card--padded" key={item.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <input type="radio" name="pageId" value={item.id} required />
          <span><strong>{item.name}</strong><br />Facebook Page ID: {item.id}
            {item.instagram_business_account ? <><br />Instagram: @{item.instagram_business_account.username ?? "username unavailable"}<br />Instagram ID: {item.instagram_business_account.id}</> : null}
            {(account.platform === "facebook" ? item.id : item.instagram_business_account?.id) === account.externalAccountId ? <><br /><strong>Currently connected</strong></> : null}
          </span>
        </label>)}
      </fieldset>
      <div className="form-actions"><button type="submit" className="button button--primary" disabled={!choices.length}>Confirm connection</button><Link className="button button--secondary" href="/social-accounts">Cancel</Link></div>
    </form>
    <p className="muted">Missing a Page? Return to Social Accounts, reconnect Meta and grant access to that Page.</p>
  </section>;
}
