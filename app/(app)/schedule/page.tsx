import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const scheduleRows = await prisma.contentSchedule.findMany({
    include: {
      blog: {
        select: { title: true },
      },
      content: {
        select: { title: true },
      },
    },
    orderBy: { scheduledFor: "asc" },
  });

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Schedule"
        description="Publishing operations for content and blog records across channels, brands, and regions."
      />

      <div className="stack">
        <Link className="button button--primary" href="/schedule/new">
          Create schedule entry
        </Link>

        {scheduleRows.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No schedule entries yet</h3>
            <p className="muted">Link content or blog records into the publishing calendar to manage planned output.</p>
          </div>
        ) : (
          <div className="card table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Channel</th>
                  <th>Scheduled For</th>
                  <th>Brand</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/schedule/${row.id}`}>{row.content?.title ?? row.blog?.title ?? "Untitled link"}</Link>
                    </td>
                    <td>{row.channel ?? "—"}</td>
                    <td>{new Date(row.scheduledFor).toLocaleString()}</td>
                    <td>{row.brand ?? "—"}</td>
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
