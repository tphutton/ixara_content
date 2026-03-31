import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { blogRows } from "@/lib/data/placeholders";

export default async function BlogsPage() {
  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Blogs"
        description="Structured editorial records built around 8 managed text and image blocks."
      />

      <DataTable
        columns={[
          { header: "Title", render: (row) => row.title },
          { header: "Category", render: (row) => row.category },
          { header: "Author", render: (row) => row.author },
          { header: "Sport", render: (row) => row.sport },
          { header: "Region", render: (row) => row.region },
          { header: "Status", render: (row) => <StatusBadge label={row.status} /> },
        ]}
        rows={blogRows}
      />
    </section>
  );
}
