import Link from "next/link";
import { ConnectedAccountStatus, PublishedPostStatus, ScheduleStatus, SocialPlatform } from "@prisma/client";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { SubmitButton } from "@/components/forms/submit-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryStats } from "@/components/ui/summary-stats";
import { prisma } from "@/lib/prisma";
import { getMetaPublishReadiness } from "@/lib/social/meta-publish";
import { publishScheduleToMetaAction } from "../schedule/actions";

export const dynamic = "force-dynamic";

type PublishingPageProps = {
  searchParams?: Promise<{ queue?: string; brand?: string }>;
};

const queueOptions = [
  { key: "ready", label: "Ready" },
  { key: "approval", label: "Needs approval" },
  { key: "account", label: "Missing account" },
  { key: "failed", label: "Failed" },
  { key: "published", label: "Published" },
  { key: "all", label: "All" },
] as const;

function publishTitle(row: {
  content: { title: string } | null;
  blog: { title: string } | null;
}) {
  return row.content?.title ?? row.blog?.title ?? "Untitled scheduled item";
}

function queueFor(row: {
  status: ScheduleStatus;
  approvedById: string | null;
  publishedPosts: Array<{ status: PublishedPostStatus }>;
  metaReadiness: { ready: boolean; reasons: string[]; account: unknown };
}) {
  if (row.status === ScheduleStatus.published || row.publishedPosts.some((post) => post.status === PublishedPostStatus.published)) {
    return "published";
  }

  if (row.publishedPosts.some((post) => post.status === PublishedPostStatus.failed)) {
    return "failed";
  }

  if (row.metaReadiness.ready) {
    return "ready";
  }

  if (!row.approvedById) {
    return "approval";
  }

  if (!row.metaReadiness.account) {
    return "account";
  }

  return "all";
}

function hasAccountBlock(reasons: string[]) {
  return reasons.some((reason) =>
    reason.toLowerCase().includes("account") ||
    reason.toLowerCase().includes("authorized") ||
    reason.toLowerCase().includes("token") ||
    reason.toLowerCase().includes("meta page"),
  );
}

export default async function PublishingPage({ searchParams }: PublishingPageProps) {
  const params = searchParams ? await searchParams : {};
  const queue = params.queue ?? "ready";
  const brandFilter = params.brand?.trim().toLowerCase() ?? "";
  const [scheduleRows, connectedAccounts] = await Promise.all([
    prisma.contentSchedule.findMany({
      include: {
        content: {
          include: {
            primaryAsset: { select: { fileUrl: true, title: true } },
            selectedVariant: { select: { platform: true, hook: true, body: true, cta: true, status: true } },
            qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        blog: {
          include: {
            featureAsset: { select: { fileUrl: true, title: true } },
            qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        publishedPosts: {
          select: {
            id: true,
            status: true,
            platform: true,
            externalPostUrl: true,
            deliveryAttempts: true,
            deliveryError: true,
            publishedAt: true,
          },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        },
      },
      orderBy: [{ scheduledFor: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    prisma.connectedAccount.findMany({
      where: {
        platform: { in: [SocialPlatform.facebook, SocialPlatform.instagram] },
        status: { in: [ConnectedAccountStatus.active, ConnectedAccountStatus.needs_reauth, ConnectedAccountStatus.error] },
      },
      orderBy: [{ status: "asc" }, { accountName: "asc" }],
    }),
  ]);

  const rows = scheduleRows.map((row) => {
    const metaReadiness = getMetaPublishReadiness(row, connectedAccounts);
    const inferredQueue = queueFor({
      status: row.status,
      approvedById: row.approvedById,
      publishedPosts: row.publishedPosts,
      metaReadiness,
    });

    return { ...row, metaReadiness, inferredQueue };
  });
  const availableBrands = Array.from(
    new Set(rows.map((row) => row.brand ?? row.content?.brand ?? row.blog?.brand).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));
  const scopedRows = rows.filter((row) => {
    const brand = row.brand ?? row.content?.brand ?? row.blog?.brand;
    return !brandFilter || brand?.toLowerCase() === brandFilter;
  });
  const queueCounts = {
    ready: scopedRows.filter((row) => row.inferredQueue === "ready").length,
    approval: scopedRows.filter((row) => row.inferredQueue === "approval").length,
    account: scopedRows.filter((row) => row.inferredQueue === "account" || hasAccountBlock(row.metaReadiness.reasons)).length,
    failed: scopedRows.filter((row) => row.inferredQueue === "failed").length,
    published: scopedRows.filter((row) => row.inferredQueue === "published").length,
    all: scopedRows.length,
  };
  const visibleRows = scopedRows.filter((row) => {
    if (queue === "all") return true;
    if (queue === "account") return row.inferredQueue === "account" || hasAccountBlock(row.metaReadiness.reasons);
    return row.inferredQueue === queue;
  });

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Publishing"
        description="Meta delivery queue for approved schedule entries, account readiness, failed publishes, and published post records."
        actions={
          <div className="header-actions">
            <Link className="button button--secondary" href="/social-accounts">
              Social accounts
            </Link>
            <Link className="button button--primary" href="/schedule">
              Open schedule
            </Link>
          </div>
        }
      />

      <div className="stack">
        <SummaryStats
          items={[
            { label: "Ready", value: queueCounts.ready, detail: "Approved and ready to publish to Meta" },
            { label: "Needs approval", value: queueCounts.approval, detail: "Waiting for schedule approval" },
            { label: "Missing account", value: queueCounts.account, detail: "Needs matching active Meta authorization" },
            { label: "Published", value: queueCounts.published, detail: "Already delivered or marked published" },
          ]}
        />

        <section className="quiet-panel command-list-header">
          <div>
            <p className="kicker">Delivery queue</p>
            <h3>{visibleRows.length} visible item{visibleRows.length === 1 ? "" : "s"}</h3>
            <p className="muted">
              {connectedAccounts.length} Meta account{connectedAccounts.length === 1 ? "" : "s"} available for matching.
            </p>
          </div>
          <div className="command-list-header__actions">
            {queueOptions.map((option) => (
              <Link
                className="inline-chip"
                data-active={queue === option.key}
                href={option.key === "ready" ? "/publishing" : `/publishing?queue=${option.key}`}
                key={option.key}
              >
                {option.label} ({queueCounts[option.key]})
              </Link>
            ))}
          </div>
        </section>

        {availableBrands.length > 0 ? (
          <div className="plan-filter-bar">
            {availableBrands.slice(0, 8).map((brand) => (
              <Link
                className="inline-chip"
                data-active={brandFilter === brand.toLowerCase()}
                href={`/publishing?queue=${queue}&brand=${encodeURIComponent(brand)}`}
                key={brand}
              >
                {brand}
              </Link>
            ))}
            {brandFilter ? (
              <Link className="inline-chip" href={queue === "ready" ? "/publishing" : `/publishing?queue=${queue}`}>
                Clear brand
              </Link>
            ) : null}
          </div>
        ) : null}

        {visibleRows.length === 0 ? (
          <div className="quiet-panel empty-state empty-state--quiet">
            <h3>No publishing items in this queue</h3>
            <p className="muted">Change queue filters, approve schedule entries, or connect a Meta account.</p>
          </div>
        ) : (
          <div className="quiet-list">
            {visibleRows.map((row) => {
              const publishAction = publishScheduleToMetaAction.bind(null, row.id);
              const latestPost = row.publishedPosts[0] ?? null;

              return (
                <article className="quiet-row publishing-row" key={row.id}>
                  <div className="quiet-row__main">
                    <div className="quiet-row__title">
                      <Link href={`/schedule/${row.id}`}>{publishTitle(row)}</Link>
                      <StatusBadge label={row.inferredQueue} />
                    </div>
                    <div className="quiet-meta">
                      <span>{new Date(row.scheduledFor).toLocaleString()}</span>
                      <span>{row.channel ?? "No channel"}</span>
                      <span>{row.brand ?? row.content?.brand ?? row.blog?.brand ?? "No brand"}</span>
                      <span>{row.metaReadiness.account?.accountName ?? "No account match"}</span>
                    </div>
                    {row.metaReadiness.reasons.length > 0 ? (
                      <ul className="quality-list publishing-row__reasons">
                        {row.metaReadiness.reasons.slice(0, 4).map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="quality-next-step">Ready for Meta delivery.</p>
                    )}
                    {latestPost ? (
                      <>
                        <div className="quiet-meta">
                          {latestPost.externalPostUrl ? (
                            <Link href={latestPost.externalPostUrl} target="_blank">
                              Latest post · {latestPost.status}
                            </Link>
                          ) : (
                            <span>Latest post · {latestPost.status}</span>
                          )}
                          {latestPost.deliveryAttempts > 0 ? <span>{latestPost.deliveryAttempts} attempt{latestPost.deliveryAttempts === 1 ? "" : "s"}</span> : null}
                        </div>
                        {latestPost.deliveryError ? <p className="field-error">{latestPost.deliveryError}</p> : null}
                      </>
                    ) : null}
                  </div>

                  <div className="row-actions">
                    <Link className="button button--secondary" href={`/schedule/${row.id}`}>
                      Open
                    </Link>
                    {row.contentId ? (
                      <Link className="button button--secondary" href={`/content/${row.contentId}`}>
                        Content
                      </Link>
                    ) : null}
                    {row.blogId ? (
                      <Link className="button button--secondary" href={`/blogs/${row.blogId}`}>
                        Blog
                      </Link>
                    ) : null}
                    {row.metaReadiness.ready ? (
                      <form action={publishAction}>
                        <SubmitButton label="Publish" pendingLabel="Publishing..." />
                      </form>
                    ) : (
                      <button className="button button--secondary" disabled type="button">
                        Publish
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
