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
        <article className="summary-tile" key={item.label} title={item.detail}>
          <p className="summary-tile__label">{item.label}</p>
          <strong>{item.value}</strong>
          <p className="summary-tile__detail">
            {item.detail}
          </p>
        </article>
      ))}
    </div>
  );
}
