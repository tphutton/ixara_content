type CampaignApiNoticeProps = {
  message: string;
};

export function CampaignApiNotice({ message }: CampaignApiNoticeProps) {
  return (
    <div className="card card--padded" style={{ borderColor: "rgba(181, 71, 8, 0.28)", background: "rgba(255, 247, 237, 0.9)" }}>
      <h3 style={{ marginTop: 0 }}>Campaign service unavailable</h3>
      <p className="muted" style={{ marginBottom: 0 }}>
        {message}
      </p>
    </div>
  );
}
