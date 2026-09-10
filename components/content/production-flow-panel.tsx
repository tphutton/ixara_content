import Link from "next/link";
import type { ReactNode } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { StatusBadge } from "@/components/ui/status-badge";

type ProductionFlowPanelProps = {
  kind: "content" | "blog";
  recordId: string;
  status: string;
  hasBody: boolean;
  hasBrand: boolean;
  hasAudience?: boolean;
  hasAsset: boolean;
  variantCount?: number;
  latestQualityScore?: number | null;
  scheduleCount: number;
  editHref: string;
  reviewAction: () => Promise<void>;
  generateVariantsAction?: () => Promise<void>;
  applyQualityAction?: () => Promise<void>;
  children?: ReactNode;
};

function getStage(input: {
  status: string;
  hasBody: boolean;
  hasBrand: boolean;
  hasAudience?: boolean;
  hasAsset: boolean;
  variantCount?: number;
  latestQualityScore?: number | null;
  scheduleCount: number;
}) {
  const missingBasics = [
    !input.hasBody ? "copy" : null,
    !input.hasBrand ? "brand" : null,
    input.hasAudience === false ? "audience" : null,
    !input.hasAsset ? "asset" : null,
  ].filter(Boolean);

  if (missingBasics.length > 0) {
    return {
      label: "Brief",
      next: `Add ${missingBasics.join(", ")} context.`,
      tone: "warning",
    };
  }

  if (input.latestQualityScore == null) {
    return { label: "Quality", next: "Run quality review.", tone: "warning" };
  }

  if (input.latestQualityScore < 75) {
    return { label: "Improve", next: "Apply or make quality recommendations.", tone: "warning" };
  }

  if ((input.variantCount ?? 0) === 0 && input.status !== "published") {
    return { label: "Variants", next: "Create channel-ready variants.", tone: "ready" };
  }

  if (input.scheduleCount === 0 && input.status !== "published") {
    return { label: "Schedule", next: "Add this to the publishing calendar.", tone: "ready" };
  }

  if (input.status === "published") {
    return { label: "Published", next: "Watch performance and feed learnings into the next plan.", tone: "ready" };
  }

  return { label: "Approval", next: "Approve, publish, or keep tracking this through schedule.", tone: "ready" };
}

export function ProductionFlowPanel({
  kind,
  recordId,
  status,
  hasBody,
  hasBrand,
  hasAudience,
  hasAsset,
  variantCount = 0,
  latestQualityScore,
  scheduleCount,
  editHref,
  reviewAction,
  generateVariantsAction,
  applyQualityAction,
  children,
}: ProductionFlowPanelProps) {
  const stage = getStage({
    status,
    hasBody,
    hasBrand,
    hasAudience,
    hasAsset,
    variantCount,
    latestQualityScore,
    scheduleCount,
  });
  const scheduleHref = kind === "content" ? `/schedule/new?contentId=${recordId}` : `/schedule/new?blogId=${recordId}`;

  return (
    <section className="quiet-panel production-flow">
      <div className="section-heading">
        <div>
          <p className="kicker">Production flow</p>
          <h3>{stage.label}</h3>
        </div>
        <StatusBadge label={stage.tone} />
      </div>

      <p className="quality-next-step">{stage.next}</p>

      <div className="production-flow__steps">
        <span data-ready={hasBody && hasBrand && hasAsset && hasAudience !== false}>Brief</span>
        <span data-ready={latestQualityScore != null}>Quality</span>
        {kind === "content" ? <span data-ready={variantCount > 0}>Variants</span> : null}
        <span data-ready={scheduleCount > 0}>Schedule</span>
        <span data-ready={status === "published"}>Published</span>
      </div>

      <div className="production-flow__actions">
        <Link className="button button--secondary" href={editHref}>
          Edit
        </Link>
        <form action={reviewAction}>
          <SubmitButton label="Run quality" pendingLabel="Reviewing..." variant="secondary" />
        </form>
        {applyQualityAction && latestQualityScore != null && latestQualityScore < 85 ? (
          <form action={applyQualityAction}>
            <SubmitButton label="Improve" pendingLabel="Improving..." variant="secondary" />
          </form>
        ) : null}
        {generateVariantsAction ? (
          <form action={generateVariantsAction}>
            <SubmitButton label="Variants" pendingLabel="Generating..." />
          </form>
        ) : null}
        <Link className="button button--primary" href={scheduleHref}>
          Schedule
        </Link>
      </div>

      {children}
    </section>
  );
}
