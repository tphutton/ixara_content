import { ContentStatus, MediaGenerationStatus, VideoBriefStatus, VideoShotStatus } from "@prisma/client";

export type UnifiedProductionStatus = {
  key: "idea" | "drafting" | "in_review" | "changes_requested" | "approved" | "generating" | "ready" | "scheduled" | "published" | "blocked";
  label: string;
  tone: "neutral" | "warning" | "ready" | "danger";
  summary: string;
};

export function getUnifiedProductionStatus(input: {
  contentStatus?: ContentStatus | string | null;
  briefStatus?: VideoBriefStatus | string | null;
  shotStatuses?: Array<VideoShotStatus | string>;
  generationStatuses?: Array<MediaGenerationStatus | string>;
  scheduleStatus?: string | null;
}) : UnifiedProductionStatus {
  const contentStatus = input.contentStatus ?? null;
  const briefStatus = input.briefStatus ?? null;
  const shotStatuses = input.shotStatuses ?? [];
  const generationStatuses = input.generationStatuses ?? [];

  if (contentStatus === ContentStatus.published || input.scheduleStatus === "published") {
    return { key: "published", label: "Published", tone: "ready", summary: "Published and ready for performance monitoring." };
  }
  if (generationStatuses.includes(MediaGenerationStatus.failed) || generationStatuses.includes(MediaGenerationStatus.cancelled)) {
    return { key: "blocked", label: "Blocked", tone: "danger", summary: "A generation job needs attention before production can continue." };
  }
  if (generationStatuses.some((status) => status === MediaGenerationStatus.queued || status === MediaGenerationStatus.submitted || status === MediaGenerationStatus.running) || briefStatus === VideoBriefStatus.generating) {
    return { key: "generating", label: "Generating", tone: "warning", summary: "Media generation is in progress or waiting to run." };
  }
  if (input.scheduleStatus === "scheduled" || contentStatus === ContentStatus.scheduled) {
    return { key: "scheduled", label: "Scheduled", tone: "ready", summary: "Approved production is connected to a publishing slot." };
  }
  if (briefStatus === VideoBriefStatus.rejected || shotStatuses.includes(VideoShotStatus.needs_changes)) {
    return { key: "changes_requested", label: "Changes requested", tone: "warning", summary: "Review notes or shot changes need to be addressed." };
  }
  if (briefStatus === VideoBriefStatus.ready || (shotStatuses.length > 0 && shotStatuses.every((status) => status === VideoShotStatus.ready))) {
    return { key: "ready", label: "Production ready", tone: "ready", summary: "The production package is ready for assembly or publishing." };
  }
  if (briefStatus === VideoBriefStatus.approved || contentStatus === ContentStatus.approved) {
    return { key: "approved", label: "Approved", tone: "ready", summary: "The current version is approved for the next production step." };
  }
  if (briefStatus === VideoBriefStatus.review) {
    return { key: "in_review", label: "In review", tone: "warning", summary: "The production package is waiting for editorial review." };
  }
  if (briefStatus || contentStatus === ContentStatus.draft) {
    return { key: "drafting", label: "Drafting", tone: "neutral", summary: "The production package is being developed." };
  }
  return { key: "idea", label: "Idea", tone: "neutral", summary: "Production has not started yet." };
}
