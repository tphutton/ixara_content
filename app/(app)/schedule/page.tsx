import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { prisma } from "@/lib/prisma";
import { getScheduleReadiness } from "@/lib/schedule/readiness";

export const dynamic = "force-dynamic";

type SchedulePageProps = {
  searchParams?: Promise<{
    queue?: string;
  }>;
};

const queueOptions = [
  { key: "all", label: "All entries" },
  { key: "ready", label: "Ready queue" },
  { key: "attention", label: "Needs attention" },
  { key: "approved", label: "Approved only" },
  { key: "week", label: "This week" },
] as const;

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const queue = resolvedSearchParams?.queue ?? "all";
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const scheduleRows = await prisma.contentSchedule.findMany({
    include: {
      blog: {
        select: {
          title: true,
          brand: true,
          websites: true,
          featureAssetId: true,
          featureImage: true,
        },
      },
      content: {
        select: {
          title: true,
          brand: true,
          tone: true,
          targetAudience: true,
          primaryAssetId: true,
          assetImage: true,
        },
      },
      approvedBy: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: { scheduledFor: "asc" },
  });

  const rowsWithReadiness = scheduleRows.map((row) => ({
    ...row,
    readiness: getScheduleReadiness({
      channel: row.channel,
      platformAccount: row.platformAccount,
      brand: row.brand,
      approvedById: row.approvedById,
      content: row.content,
      blog: row.blog,
    }),
  }));

  const filteredRows = rowsWithReadiness.filter((row) => {
    if (queue === "ready") {
      return row.readiness.isReady;
    }

    if (queue === "attention") {
      return !row.readiness.isReady;
    }

    if (queue === "approved") {
      return Boolean(row.approvedById);
    }

    if (queue === "week") {
      return row.scheduledFor >= now && row.scheduledFor <= weekEnd;
    }

    return true;
  });

  const queueSummary = {
    all: rowsWithReadiness.length,
    ready: rowsWithReadiness.filter((row) => row.readiness.isReady).length,
    attention: rowsWithReadiness.filter((row) => !row.readiness.isReady).length,
    approved: rowsWithReadiness.filter((row) => row.approvedById).length,
    week: rowsWithReadiness.filter((row) => row.scheduledFor >= now && row.scheduledFor <= weekEnd)
      .length,
  };

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Schedule"
        description="Publishing operations for content and blog records across channels, brands, and regions."
      />

      <div className="stack">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Link className="button button--primary" href="/schedule/new">
            Create schedule entry
          </Link>

          {queueOptions.map((option) => (
            <Link
              className="button button--secondary"
              href={option.key === "all" ? "/schedule" : `/schedule?queue=${option.key}`}
              key={option.key}
            >
              {option.label} ({queueSummary[option.key]})
            </Link>
          ))}
        </div>

        {filteredRows.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No schedule entries in this queue</h3>
            <p className="muted">
              Adjust the queue filter or create a new schedule entry to populate this workflow
              view.
            </p>
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
                  <th>Approval</th>
                  <th>Readiness</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/schedule/${row.id}`}>{row.content?.title ?? row.blog?.title ?? "Untitled link"}</Link>
                    </td>
                    <td>{row.channel ?? "—"}</td>
                    <td>{new Date(row.scheduledFor).toLocaleString()}</td>
                    <td>{row.brand ?? "—"}</td>
                    <td>
                      {row.approvedBy
                        ? row.approvedBy.fullName ?? row.approvedBy.email
                        : "Unapproved"}
                    </td>
                    <td>
                      <StatusBadge label={row.readiness.isReady ? "ready" : "warning"} />
                    </td>
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
