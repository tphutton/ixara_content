import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { getBlogReadiness } from "@/lib/blogs/readiness";
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

function stripHtml(value: string | null) {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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
  const publishedCount = rowsWithReadiness.filter((row) => row.status === "published").length;
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
        actions={
          <Link className="button button--primary" href="/blogs/new">
            Create blog
          </Link>
        }
      />

      <div className="stack">
        <section className="quiet-panel command-list-header">
          <div>
            <p className="kicker">Editorial queue</p>
            <h3>
              {filteredRows.length} visible article{filteredRows.length === 1 ? "" : "s"}
            </h3>
            <p className="muted">
              {queueCounts.ready} ready, {queueCounts.attention} need attention, {publishedCount} published.
            </p>
          </div>
          <div className="command-list-header__actions">
            {queueOptions.map((option) => (
              <Link
                className="inline-chip"
                data-active={queue === option.key}
                href={option.key === "all" ? "/blogs" : `/blogs?queue=${option.key}`}
                key={option.key}
              >
                {option.label} ({queueCounts[option.key]})
              </Link>
            ))}
          </div>
        </section>

        {availableBrands.length > 0 ? (
          <div className="plan-filter-bar">
            {availableBrands.slice(0, 6).map((brand) => (
              <Link
                className="inline-chip"
                data-active={brandFilter === brand.toLowerCase()}
                href={`/blogs?queue=${queue}&brand=${encodeURIComponent(brand)}`}
                key={brand}
              >
                {brand}
              </Link>
            ))}
            {brandFilter ? (
              <Link
                className="inline-chip"
                href={queue === "all" ? "/blogs" : `/blogs?queue=${queue}`}
              >
                Clear brand filter
              </Link>
            ) : null}
          </div>
        ) : null}

        {filteredRows.length === 0 ? (
          <div className="quiet-panel empty-state empty-state--quiet">
            <h3>No blog records in this queue</h3>
            <p className="muted">
              Adjust the queue or brand filter, or create a new structured article to populate this
              view.
            </p>
          </div>
        ) : (
          <div className="blog-list">
            {filteredRows.map((row) => (
              <article className="card card--padded blog-list-card" key={row.id}>
                <div className="blog-list-card__header">
                  <div className="stack" style={{ gap: 8 }}>
                    <div className="blog-chip-row">
                      <StatusBadge label={row.status} />
                      <StatusBadge label={row.readiness.ready ? "ready" : "warning"} />
                      {row.category ? <span className="inline-chip">{row.category}</span> : null}
                    </div>
                    <div>
                      <Link className="blog-list-card__title" href={`/blogs/${row.id}`}>
                        {row.title}
                      </Link>
                      <p className="muted" style={{ marginTop: 8 }}>
                        {stripHtml(row.text1).slice(0, 220) || "No introduction added yet."}
                      </p>
                    </div>
                  </div>
                  <div className="toolbar__group">
                    <Link className="button button--secondary" href={`/blogs/${row.id}`}>
                      View
                    </Link>
                    <Link className="button button--primary" href={`/blogs/${row.id}?edit=1`}>
                      Update
                    </Link>
                  </div>
                </div>

                <div className="blog-list-card__meta">
                  <div>
                    <span>Brand</span>
                    <strong>{row.brand ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Author</span>
                    <strong>{row.authorName ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Websites</span>
                    <strong>{row.websites.length ? row.websites.join(", ") : "—"}</strong>
                  </div>
                  <div>
                    <span>Coverage</span>
                    <strong>
                      {[row.sport, row.region, row.country].filter(Boolean).join(" • ") || "—"}
                    </strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
