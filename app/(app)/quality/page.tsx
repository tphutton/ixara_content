import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryStats } from "@/components/ui/summary-stats";
import { getQualityCommandSummary } from "@/lib/quality/summary";

export const dynamic = "force-dynamic";

export default async function QualityPage() {
  const summary = await getQualityCommandSummary();

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Quality"
        description="AI editorial command center for weak drafts, missing reviews, publishing risk, and improvement recommendations."
        actions={
          <Link
            className="button button--primary"
            href="/chat?prompt=Review%20the%20quality%20pipeline%20and%20tell%20me%20which%20content%2C%20blogs%2C%20or%20plan%20items%20need%20attention%20before%20publishing."
          >
            Ask Quill
          </Link>
        }
      />

      <div className="stack">
        <SummaryStats items={summary.metrics} />

        <section className="quiet-panel">
          <div className="section-heading">
            <div>
              <p className="kicker">Priority queue</p>
              <h3>Needs editorial work</h3>
            </div>
            <span className="inline-chip">{summary.weakReviews.length} active issue{summary.weakReviews.length === 1 ? "" : "s"}</span>
          </div>

          {summary.weakReviews.length === 0 ? (
            <div className="empty-state empty-state--quiet">
              <h3>No weak reviewed items</h3>
              <p className="muted">Latest reviewed targets are meeting the current quality gate.</p>
            </div>
          ) : (
            <div className="quality-command-list">
              {summary.weakReviews.map((review) => (
                <Link className="quality-command-row" href={review.href} key={review.id}>
                  <div className="quality-command-row__score">
                    <strong>{review.overallScore}</strong>
                    <span>score</span>
                  </div>
                  <div className="quality-command-row__main">
                    <div className="quiet-row__title">
                      <strong>{review.targetTitle}</strong>
                      <StatusBadge label={review.verdict} />
                    </div>
                    <p className="muted">{review.summary}</p>
                    <div className="quiet-meta">
                      <span>{review.targetType}</span>
                      <span>{review.brand ?? "No brand"}</span>
                      <span>Risk {review.riskScore}/100</span>
                      <span>{formatDistanceToNow(review.createdAt, { addSuffix: true })}</span>
                    </div>
                    {review.recommendations.length > 0 ? (
                      <p className="quality-next-step">{review.recommendations[0]}</p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="quality-command-grid">
          <article className="quiet-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Missing gate</p>
                <h3>Needs first review</h3>
              </div>
            </div>

            <div className="quiet-list">
              {summary.missingReviewItems.length === 0 ? (
                <p className="muted">No active unreviewed work found.</p>
              ) : (
                summary.missingReviewItems.map((item) => (
                  <Link className="quiet-row quiet-row--link" href={item.href} key={`${item.type}:${item.id}`}>
                    <div className="quiet-row__main">
                      <div className="quiet-row__title">
                        <strong>{item.title}</strong>
                        <StatusBadge label={item.status} />
                      </div>
                      <div className="quiet-meta">
                        <span>{item.type}</span>
                        <span>{item.brand ?? "No brand"}</span>
                        <span>{formatDistanceToNow(item.updatedAt, { addSuffix: true })}</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </article>

          <article className="quiet-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Latest reviews</p>
                <h3>Recent quality decisions</h3>
              </div>
              <span className="inline-chip">{summary.publishReadyCount} publish-ready</span>
            </div>

            <div className="quiet-list">
              {summary.latestReviews.length === 0 ? (
                <p className="muted">No quality reviews have been saved yet.</p>
              ) : (
                summary.latestReviews.slice(0, 12).map((review) => (
                  <Link className="quiet-row quiet-row--link" href={review.href} key={review.id}>
                    <div className="quiet-row__main">
                      <div className="quiet-row__title">
                        <strong>{review.targetTitle}</strong>
                        <StatusBadge label={review.verdict} />
                      </div>
                      <div className="quiet-meta">
                        <span>{review.overallScore}/100</span>
                        <span>{review.targetType}</span>
                        <span>{formatDistanceToNow(review.createdAt, { addSuffix: true })}</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    </section>
  );
}
