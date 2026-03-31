import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { scheduleRows } from "@/lib/data/placeholders";

export default async function SchedulePage() {
  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Schedule"
        description="Publishing operations for content and blog records across channels, brands, and regions."
      />

      <DataTable
        columns={[
          { header: "Item", render: (row) => row.item },
          { header: "Channel", render: (row) => row.channel },
          { header: "Scheduled For", render: (row) => row.scheduledFor },
          { header: "Brand", render: (row) => row.brand },
          { header: "Status", render: (row) => <StatusBadge label={row.status} /> },
        ]}
        rows={scheduleRows}
      />
    </section>
  );
}
