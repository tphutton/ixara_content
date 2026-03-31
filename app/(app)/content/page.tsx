import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ContentPageProps = {
  searchParams?: Promise<{
    queue?: string;
    brand?: string;
  }>;
};

const queueOptions = [
  { key: "all", label: "All" },
  { key: "ready", label: "Automation ready" },
  { key: "attention", label: "Needs attention" },
  { key: "drafts", label: "Drafts" },
] as const;

function getContentReadiness(row: {
  brand: string | null;
  tone: string | null;
  targetAudience: string | null;
  primaryAssetId: string | null;
  assetImage: string | null;
}) {
  const reasons: string[] = [];

  if (!row.brand) reasons.push("brand");
  if (!row.tone) reasons.push("tone");
  if (!row.targetAudience) reasons.push("audience");
  if (!row.primaryAssetId && !row.assetImage) reasons.push("asset");

  return {
    ready: reasons.length === 0,
    reasons,
  };
}

export default async function ContentPage({ searchParams }: ContentPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const queue = resolvedSearchParams?.queue ?? "all";
  const brandFilter = resolvedSearchParams?.brand?.trim().toLowerCase() ?? "";

  const contentRows = await prisma.content.findMany({
    orderBy: { updatedAt: "desc" },
  });
  const rowsWithReadiness = contentRows.map((row) => ({
    ...row,
    readiness: getContentReadiness(row),
  }));
  const queueCounts = {
    all: rowsWithReadiness.length,
    ready: rowsWithReadiness.filter((row) => row.readiness.ready).length,
    attention: rowsWithReadiness.filter((row) => !row.readiness.ready).length,
    drafts: rowsWithReadiness.filter((row) => row.status === "draft").length,
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
    if (queue === "drafts" && row.status !== "draft") return false;
    if (brandFilter && row.brand?.toLowerCase() !== brandFilter) return false;
    return true;
  });

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Content"
        description="Operational table for short-form content, campaign copy, and channel-specific assets."
      />

      <div className="stack">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Link className="button button--primary" href="/content/new">
            Create content
          </Link>

          {queueOptions.map((option) => (
            <Link
              className="button button--secondary"
              href={option.key === "all" ? "/content" : `/content?queue=${option.key}`}
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
              href={`/content?queue=${queue}&brand=${encodeURIComponent(brand)}`}
              key={brand}
            >
              {brand}
            </Link>
          ))}
          {brandFilter ? (
            <Link
              className="button button--secondary"
              href={queue === "all" ? "/content" : `/content?queue=${queue}`}
            >
              Clear brand filter
            </Link>
          ) : null}
        </div>

        {filteredRows.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No content records in this queue</h3>
            <p className="muted">
              Adjust the queue or brand filter, or create a new record to populate this view.
            </p>
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
                  <th>Readiness</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/content/${row.id}`}>{row.title}</Link>
                    </td>
                    <td>{row.contentType}</td>
                    <td>{row.platform ?? "—"}</td>
                    <td>{row.brand ?? "—"}</td>
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
