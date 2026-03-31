import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BlogsPageProps = {
  searchParams?: Promise<{
    queue?: string;
    status?: string;
    brand?: string;
  }>;
};

const queueOptions = [
  { key: "all", label: "All" },
  { key: "ready", label: "Automation ready" },
  { key: "attention", label: "Needs attention" },
  { key: "review", label: "In review" },
] as const;

function getBlogReadiness(row: {
  brand: string | null;
  websites: string[];
  featureAssetId: string | null;
  featureImage: string | null;
}) {
  const reasons: string[] = [];

  if (!row.brand) reasons.push("brand");
  if (row.websites.length === 0) reasons.push("websites");
  if (!row.featureAssetId && !row.featureImage) reasons.push("feature image");

  return {
    ready: reasons.length === 0,
    reasons,
  };
}

export default async function BlogsPage({ searchParams }: BlogsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const queue = resolvedSearchParams?.queue ?? "all";
  const brandFilter = resolvedSearchParams?.brand?.trim().toLowerCase() ?? "";

  const blogRows = await prisma.blog.findMany({
    orderBy: { updatedAt: "desc" },
  });
  const rowsWithReadiness = blogRows.map((row) => ({
    ...row,
    readiness: getBlogReadiness(row),
  }));
  const queueCounts = {
    all: rowsWithReadiness.length,
    ready: rowsWithReadiness.filter((row) => row.readiness.ready).length,
    attention: rowsWithReadiness.filter((row) => !row.readiness.ready).length,
    review: rowsWithReadiness.filter((row) => row.status === "review").length,
  };
  const availableBrands = Array.from(
    new Set(
      rowsWithReadiness
        .map((row) => row.brand)
        .filter((brand): brand is string => Boolean(brand)),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const filteredRows = rowsWithReadiness.filter((row) => {
    if (queue === "ready" && !row.readiness.ready) return false;
    if (queue === "attention" && row.readiness.ready) return false;
    if (queue === "review" && row.status !== "review") return false;
    if (brandFilter && row.brand?.toLowerCase() !== brandFilter) return false;
    return true;
  });

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Blogs"
        description="Structured editorial records built around 8 managed text and image blocks."
      />

      <div className="stack">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Link className="button button--primary" href="/blogs/new">
            Create blog
          </Link>

          {queueOptions.map((option) => (
            <Link
              className="button button--secondary"
              href={option.key === "all" ? "/blogs" : `/blogs?queue=${option.key}`}
              key={option.key}
            >
              {option.label} ({queueCounts[option.key]})
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {availableBrands.slice(0, 6).map((brand) => (
            <Link
              className="button button--secondary"
              href={`/blogs?queue=${queue}&brand=${encodeURIComponent(brand)}`}
              key={brand}
            >
              {brand}
            </Link>
          ))}
          {brandFilter ? (
            <Link
              className="button button--secondary"
              href={queue === "all" ? "/blogs" : `/blogs?queue=${queue}`}
            >
              Clear brand filter
            </Link>
          ) : null}
        </div>

        {filteredRows.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No blog records in this queue</h3>
            <p className="muted">
              Adjust the queue or brand filter, or create a new structured article to populate this
              view.
            </p>
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
                  <th>Readiness</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
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
                      <StatusBadge label={row.readiness.ready ? "ready" : "warning"} />
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
