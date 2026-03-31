type SummaryStat = {
  label: string;
  value: number | string;
  detail: string;
};

type SummaryStatsProps = {
  items: SummaryStat[];
};

export function SummaryStats({ items }: SummaryStatsProps) {
  return (
    <div className="summary-strip">
      {items.map((item) => (
        <article className="card card--padded summary-tile" key={item.label}>
          <p className="summary-tile__label">{item.label}</p>
          <strong>{item.value}</strong>
          <p className="muted" style={{ margin: "10px 0 0" }}>
            {item.detail}
          </p>
        </article>
      ))}
    </div>
  );
}
