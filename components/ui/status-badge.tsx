import clsx from "clsx";

const toneByStatus: Record<string, string> = {
  active: "rgba(20, 184, 166, 0.14)",
  approved: "rgba(20, 184, 166, 0.14)",
  failed: "rgba(244, 63, 94, 0.16)",
  draft: "rgba(59, 130, 246, 0.16)",
  idea: "rgba(148, 163, 184, 0.12)",
  paused: "rgba(245, 158, 11, 0.16)",
  pending: "rgba(245, 158, 11, 0.16)",
  planned: "rgba(59, 130, 246, 0.16)",
  published: "rgba(14, 165, 233, 0.16)",
  publish_ready: "rgba(20, 184, 166, 0.14)",
  ready: "rgba(20, 184, 166, 0.14)",
  review: "rgba(245, 158, 11, 0.16)",
  running: "rgba(59, 130, 246, 0.16)",
  scheduled: "rgba(168, 85, 247, 0.16)",
  succeeded: "rgba(20, 184, 166, 0.14)",
  warning: "rgba(245, 158, 11, 0.16)",
  improve_before_publish: "rgba(245, 158, 11, 0.16)",
  major_revision: "rgba(244, 63, 94, 0.16)",
};

const textByStatus: Record<string, string> = {
  active: "#5eead4",
  approved: "#5eead4",
  failed: "#fda4af",
  draft: "#93c5fd",
  idea: "#cbd5e1",
  paused: "#fcd34d",
  pending: "#fcd34d",
  planned: "#93c5fd",
  published: "#7dd3fc",
  publish_ready: "#5eead4",
  ready: "#5eead4",
  review: "#fcd34d",
  running: "#93c5fd",
  scheduled: "#d8b4fe",
  succeeded: "#5eead4",
  warning: "#fcd34d",
  improve_before_publish: "#fcd34d",
  major_revision: "#fda4af",
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
        background: toneByStatus[key] ?? "rgba(148, 163, 184, 0.12)",
        color: textByStatus[key] ?? "#cbd5e1",
        borderColor: "rgba(255, 255, 255, 0.08)",
      }}
    >
      {label}
    </span>
  );
}
