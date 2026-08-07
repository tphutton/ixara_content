import type { QualityReview } from "@prisma/client";

export const QUALITY_APPROVAL_SCORE = 70;
export const QUALITY_BLOCKING_SCORE = 55;

export type QualityGate = {
  ready: boolean;
  blocking: boolean;
  label: string;
  reasons: string[];
};

export function getQualityGate(review: QualityReview | null): QualityGate {
  if (!review) {
    return {
      ready: false,
      blocking: false,
      label: "Not reviewed",
      reasons: ["No saved quality review exists yet."],
    };
  }

  const reasons: string[] = [];

  if (review.overallScore < QUALITY_APPROVAL_SCORE) {
    reasons.push(`Overall quality is ${review.overallScore}/100; target is ${QUALITY_APPROVAL_SCORE} or higher.`);
  }

  if (review.verdict === "major_revision") {
    reasons.push("Latest verdict is major revision.");
  }

  if (review.riskScore < QUALITY_APPROVAL_SCORE) {
    reasons.push(`Publishing risk score is ${review.riskScore}/100; target is ${QUALITY_APPROVAL_SCORE} or higher.`);
  }

  return {
    ready: reasons.length === 0,
    blocking: review.overallScore < QUALITY_BLOCKING_SCORE || review.verdict === "major_revision",
    label: `${review.overallScore}/100 · ${review.verdict}`,
    reasons,
  };
}
