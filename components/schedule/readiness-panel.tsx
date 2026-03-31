import { ScheduleReadiness } from "@/lib/schedule/readiness";

type ReadinessPanelProps = {
  readiness: ScheduleReadiness;
};

export function ReadinessPanel({ readiness }: ReadinessPanelProps) {
  return (
    <article className="card card--padded">
      <p className="kicker">Readiness</p>
      <h3 style={{ marginTop: 0 }}>
        {readiness.isReady ? "Ready for automation" : "Needs attention"}
      </h3>
      <p className="muted">
        {readiness.isReady
          ? "This entry has the core metadata needed for future automation and publishing workflows."
          : "Resolve the items below before relying on this entry for automation or publishing queues."}
      </p>

      {readiness.reasons.length > 0 ? (
        <div className="stack" style={{ gap: 10, marginTop: 16 }}>
          {readiness.reasons.map((reason) => (
            <span className="inline-chip" key={reason}>
              {reason}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
