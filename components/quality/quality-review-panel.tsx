import { QualityReview } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { SubmitButton } from "@/components/forms/submit-button";
import { StatusBadge } from "@/components/ui/status-badge";

type QualityReviewPanelProps = {
  action: () => Promise<void>;
  reviews: QualityReview[];
};

function scoreLabel(score: number) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 55) return "needs work";
  return "weak";
}

export function QualityReviewPanel({ action, reviews }: QualityReviewPanelProps) {
  const latest = reviews[0] ?? null;

  return (
    <section className="quiet-panel quality-panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Quality gate</p>
          <h3>{latest ? `${latest.overallScore}/100` : "Not reviewed"}</h3>
        </div>
        {latest ? <StatusBadge label={latest.verdict} /> : <StatusBadge label="pending" />}
      </div>

      {latest ? (
        <div className="stack">
          <p className="muted">{latest.summary}</p>

          <div className="quality-score-grid">
            {[
              ["Brand", latest.brandScore],
              ["Audience", latest.audienceScore],
              ["Clarity", latest.clarityScore],
              ["Channel", latest.channelScore],
              ["Conversion", latest.conversionScore],
              ["Risk", latest.riskScore],
            ].map(([label, score]) => (
              <div className="quality-score" key={label}>
                <span>{label}</span>
                <strong>{score}</strong>
                <small>{scoreLabel(Number(score))}</small>
              </div>
            ))}
          </div>

          <div className="quality-columns">
            <div>
              <p className="kicker">Issues</p>
              <ul className="quality-list">
                {latest.issues.length ? latest.issues.map((item) => <li key={item}>{item}</li>) : <li>No major issues captured.</li>}
              </ul>
            </div>
            <div>
              <p className="kicker">Next edits</p>
              <ul className="quality-list">
                {latest.recommendations.length ? latest.recommendations.map((item) => <li key={item}>{item}</li>) : <li>No recommendations captured.</li>}
              </ul>
            </div>
          </div>

          {latest.rewrittenHook || latest.rewrittenCTA ? (
            <div className="quality-rewrite">
              {latest.rewrittenHook ? (
                <div>
                  <span>Suggested hook</span>
                  <p>{latest.rewrittenHook}</p>
                </div>
              ) : null}
              {latest.rewrittenCTA ? (
                <div>
                  <span>Suggested CTA</span>
                  <p>{latest.rewrittenCTA}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="muted">
            Reviewed {formatDistanceToNow(latest.createdAt, { addSuffix: true })}
            {latest.model ? ` with ${latest.model}` : ""}
          </p>
        </div>
      ) : (
        <p className="muted">Run a review before approving or scheduling. The AI checks brand fit, audience clarity, channel suitability, CTA strength, and publishing risk.</p>
      )}

      <form action={action}>
        <SubmitButton label="Run quality review" pendingLabel="Reviewing..." />
      </form>
    </section>
  );
}
