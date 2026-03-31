import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BlogsPage() {
  const blogRows = await prisma.blog.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Blogs"
        description="Structured editorial records built around 8 managed text and image blocks."
      />

      <div className="stack">
        <Link className="button button--primary" href="/blogs/new">
          Create blog
        </Link>

        {blogRows.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No blog records yet</h3>
            <p className="muted">Create your first structured article to start building the editorial library.</p>
          </div>
        ) : (
          <div className="card table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th>Author</th>
                  <th>Sport</th>
                  <th>Region</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {blogRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/blogs/${row.id}`}>{row.title}</Link>
                    </td>
                    <td>{row.brand ?? "—"}</td>
                    <td>{row.category ?? "—"}</td>
                    <td>{row.authorName ?? "—"}</td>
                    <td>{row.sport ?? "—"}</td>
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
