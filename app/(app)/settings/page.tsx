import Link from "next/link";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  return (
    <section className="page-shell page-shell--narrow">
      <WorkspaceHeader
        title="Settings"
        description="Workspace configuration, deployment notes, and admin controls."
      />

      <section className="quiet-panel">
        <div className="section-heading">
          <div>
            <p className="kicker">Brand intelligence</p>
            <h3>Brand profiles now live in Brands</h3>
            <p className="muted">
              Manage the AI memory for tone, audience, offers, channels, and publishing rules from the dedicated Brands workspace.
            </p>
          </div>
          <Link className="button button--primary" href="/brands">
            Open Brands
          </Link>
        </div>
      </section>

      <section className="quiet-panel">
        <div>
          <p className="kicker">Admin</p>
          <h3>Workspace controls</h3>
        </div>
        <div className="quick-action-grid">
          <Link className="quick-action" href="/admin/approvals">Approvals</Link>
          <Link className="quick-action" href="/social-accounts">Social accounts</Link>
          <Link className="quick-action" href="/automations">Automations</Link>
          <Link className="quick-action" href="/dashboard">Dashboard</Link>
        </div>
      </section>
    </section>
  );
}
