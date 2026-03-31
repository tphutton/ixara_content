import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const contentRows = await prisma.content.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Content"
        description="Operational table for short-form content, campaign copy, and channel-specific assets."
      />

      <div className="stack">
        <Link className="button button--primary" href="/content/new">
          Create content
        </Link>

        {contentRows.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No content records yet</h3>
            <p className="muted">Create your first social, campaign, or newsletter record to start managing content operations here.</p>
          </div>
        ) : (
          <div className="card table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Platform</th>
                  <th>Brand</th>
                  <th>Region</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {contentRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/content/${row.id}`}>{row.title}</Link>
                    </td>
                    <td>{row.contentType}</td>
                    <td>{row.platform ?? "—"}</td>
                    <td>{row.brand ?? "—"}</td>
                    <td>{row.region ?? "—"}</td>
                    <td>
                      <StatusBadge label={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
