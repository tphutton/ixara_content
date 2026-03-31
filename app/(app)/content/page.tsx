import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryStats } from "@/components/ui/summary-stats";
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
  const publishedCount = rowsWithReadiness.filter((row) => row.status === "published").length;
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
        <SummaryStats
          items={[
            {
              label: "Total records",
              value: queueCounts.all,
              detail: `${availableBrands.length} active brands in the content library`,
            },
            {
              label: "Automation ready",
              value: queueCounts.ready,
              detail: "Ready for automation workflows or scheduling",
            },
            {
              label: "Needs attention",
              value: queueCounts.attention,
              detail: "Missing brand, audience, tone, or asset context",
            },
            {
              label: "Published",
              value: publishedCount,
              detail: "Live content records already moved through the workflow",
            },
          ]}
        />

        <div className="toolbar">
          <div className="toolbar__group">
            <Link className="button button--primary" href="/content/new">
              Create content
            </Link>
          </div>
          <div className="toolbar__group">
            {queueOptions.map((option) => (
              <Link
                className="button button--secondary"
                data-active={queue === option.key}
                href={option.key === "all" ? "/content" : `/content?queue=${option.key}`}
                key={option.key}
              >
                {option.label} ({queueCounts[option.key]})
              </Link>
            ))}
          </div>
        </div>

        <div className="toolbar">
          <div className="toolbar__group">
            {availableBrands.slice(0, 6).map((brand) => (
              <Link
                className="button button--secondary"
                data-active={brandFilter === brand.toLowerCase()}
                href={`/content?queue=${queue}&brand=${encodeURIComponent(brand)}`}
                key={brand}
              >
                {brand}
              </Link>
            ))}
          </div>
          <div className="toolbar__group">
            {brandFilter ? (
              <Link
                className="button button--secondary"
                href={queue === "all" ? "/content" : `/content?queue=${queue}`}
              >
                Clear brand filter
              </Link>
            ) : null}
          </div>
        </div>

        <div className="card card--padded">
          <div className="section-heading">
            <div>
              <p className="kicker">Operational queue</p>
              <h3 style={{ marginTop: 0 }}>
                {queue === "all"
                  ? "All content records"
                  : queue === "ready"
                    ? "Automation-ready content"
                    : queue === "attention"
                      ? "Content needing attention"
                      : "Draft content"}
              </h3>
            </div>
            <span className="inline-chip">
              {filteredRows.length} visible record{filteredRows.length === 1 ? "" : "s"}
            </span>
          </div>
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
