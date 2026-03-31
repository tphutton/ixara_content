import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { contentRows } from "@/lib/data/placeholders";

export default async function ContentPage() {
  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Content"
        description="Operational table for short-form content, campaign copy, and channel-specific assets."
      />

      <DataTable
        columns={[
          { header: "Title", render: (row) => row.title },
          { header: "Type", render: (row) => row.type },
          { header: "Platform", render: (row) => row.platform },
          { header: "Brand", render: (row) => row.brand },
          { header: "Region", render: (row) => row.region },
          { header: "Status", render: (row) => <StatusBadge label={row.status} /> },
        ]}
        rows={contentRows}
      />
    </section>
  );
}
