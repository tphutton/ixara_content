import clsx from "clsx";

const toneByStatus: Record<string, string> = {
  active: "rgba(15, 118, 110, 0.12)",
  approved: "rgba(15, 118, 110, 0.12)",
  draft: "rgba(21, 94, 239, 0.12)",
  idea: "rgba(71, 84, 103, 0.12)",
  pending: "rgba(181, 71, 8, 0.12)",
  planned: "rgba(21, 94, 239, 0.12)",
  published: "rgba(2, 132, 199, 0.12)",
  review: "rgba(146, 64, 14, 0.12)",
  scheduled: "rgba(91, 33, 182, 0.12)",
  warning: "rgba(181, 71, 8, 0.12)",
};

const textByStatus: Record<string, string> = {
  active: "#0f766e",
  approved: "#0f766e",
  draft: "#155eef",
  idea: "#475467",
  pending: "#b54708",
  planned: "#155eef",
  published: "#027a9d",
  review: "#92400e",
  scheduled: "#5b21b6",
  warning: "#b54708",
};

type StatusBadgeProps = {
  label: string;
};

export function StatusBadge({ label }: StatusBadgeProps) {
  const key = label.toLowerCase();

  return (
    <span
      className={clsx("badge")}
      style={{
        background: toneByStatus[key] ?? "rgba(71, 84, 103, 0.12)",
        color: textByStatus[key] ?? "#475467",
        borderColor: "transparent",
      }}
    >
      {label}
    </span>
  );
}
