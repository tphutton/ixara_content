import {
  BlogStatus,
  ContentPlanItemStatus,
  ContentPlanStatus,
  ContentStatus,
  EditorialApprovalDecision,
  EditorialApprovalTargetType,
  ScheduleStatus,
  type UserAccess,
} from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { getPlanItemBriefReadiness } from "@/lib/plans/brief-readiness";
import { prisma } from "@/lib/prisma";
import { getQualityGate } from "@/lib/quality/gates";

export type EditorialApprovalTarget = {
  type: EditorialApprovalTargetType;
  id: string;
};

export async function getEditorialApprovalHistory(target: EditorialApprovalTarget) {
  return prisma.editorialApproval.findMany({
    where: { targetType: target.type, targetId: target.id },
    include: {
      requestedBy: { select: { fullName: true, email: true } },
      decidedBy: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

async function assertApprovalReady(target: EditorialApprovalTarget) {
  if (target.type === EditorialApprovalTargetType.content_plan) {
    const plan = await prisma.contentPlan.findUniqueOrThrow({
      where: { id: target.id },
      include: { items: { select: { status: true } } },
    });
    if (plan.items.length === 0) throw new Error("Add at least one work item before approving this plan.");
    if (plan.items.some((item) => item.status === ContentPlanItemStatus.blocked)) {
      throw new Error("Resolve blocked plan items before approval.");
    }
    return;
  }

  if (target.type === EditorialApprovalTargetType.content_plan_item) {
    const item = await prisma.contentPlanItem.findUniqueOrThrow({ where: { id: target.id }, include: { plan: true, qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 } } });
    const brand = item.brand ?? item.plan.brand;
    const profile = brand ? await prisma.brandProfile.findFirst({ where: { brandName: { equals: brand, mode: "insensitive" } }, select: { targetAudience: true, defaultTone: true, preferredCTAs: true } }) : null;
    const readiness = getPlanItemBriefReadiness(item, item.plan, profile);
    if (!readiness.ready) throw new Error(`Complete the brief before approval: ${readiness.missing.map((gap) => gap.label).join(", ")}.`);
    const quality = getQualityGate(item.qualityReviews[0] ?? null);
    if (!quality.ready) throw new Error(`Quality gate not ready: ${quality.reasons.join(" ")}`);
    return;
  }

  if (target.type === EditorialApprovalTargetType.content || target.type === EditorialApprovalTargetType.blog) {
    const reviews = target.type === EditorialApprovalTargetType.content
      ? await prisma.qualityReview.findMany({ where: { contentId: target.id }, orderBy: { createdAt: "desc" }, take: 1 })
      : await prisma.qualityReview.findMany({ where: { blogId: target.id }, orderBy: { createdAt: "desc" }, take: 1 });
    const quality = getQualityGate(reviews[0] ?? null);
    if (!quality.ready) throw new Error(`Quality gate not ready: ${quality.reasons.join(" ")}`);
    return;
  }

  if (target.type === EditorialApprovalTargetType.content_variant) {
    const variant = await prisma.contentVariant.findUniqueOrThrow({ where: { id: target.id }, include: { content: { include: { qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 } } } } });
    if (!variant.body && !variant.hook) throw new Error("Add variant copy before approval.");
    const quality = getQualityGate(variant.content.qualityReviews[0] ?? null);
    if (!quality.ready) throw new Error(`Parent content quality gate not ready: ${quality.reasons.join(" ")}`);
    return;
  }

  const schedule = await prisma.contentSchedule.findUniqueOrThrow({ where: { id: target.id }, include: { content: { include: { qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 } } }, blog: { include: { qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 } } } } });
  const quality = getQualityGate(schedule.content?.qualityReviews[0] ?? schedule.blog?.qualityReviews[0] ?? null);
  if (!quality.ready) throw new Error(`Quality gate not ready: ${quality.reasons.join(" ")}`);
}

async function syncApprovedState(target: EditorialApprovalTarget, access: UserAccess) {
  if (target.type === EditorialApprovalTargetType.content_plan) await prisma.contentPlan.update({ where: { id: target.id }, data: { status: ContentPlanStatus.approved, updatedById: access.id } });
  if (target.type === EditorialApprovalTargetType.content_plan_item) await prisma.contentPlanItem.update({ where: { id: target.id }, data: { status: ContentPlanItemStatus.approved } });
  if (target.type === EditorialApprovalTargetType.content) await prisma.content.update({ where: { id: target.id }, data: { status: ContentStatus.approved, updatedById: access.id } });
  if (target.type === EditorialApprovalTargetType.blog) await prisma.blog.update({ where: { id: target.id }, data: { status: BlogStatus.approved, updatedById: access.id } });
  if (target.type === EditorialApprovalTargetType.content_variant) await prisma.contentVariant.update({ where: { id: target.id }, data: { status: ContentStatus.approved, updatedById: access.id } });
  if (target.type === EditorialApprovalTargetType.schedule) await prisma.contentSchedule.update({ where: { id: target.id }, data: { approvedById: access.id, status: ScheduleStatus.ready } });
}

async function syncRevokedState(target: EditorialApprovalTarget, access: UserAccess) {
  if (target.type === EditorialApprovalTargetType.content_plan) await prisma.contentPlan.update({ where: { id: target.id }, data: { status: ContentPlanStatus.review, updatedById: access.id } });
  if (target.type === EditorialApprovalTargetType.content_plan_item) await prisma.contentPlanItem.update({ where: { id: target.id }, data: { status: ContentPlanItemStatus.planned } });
  if (target.type === EditorialApprovalTargetType.content) await prisma.content.update({ where: { id: target.id }, data: { status: ContentStatus.draft, updatedById: access.id } });
  if (target.type === EditorialApprovalTargetType.blog) await prisma.blog.update({ where: { id: target.id }, data: { status: BlogStatus.review, updatedById: access.id } });
  if (target.type === EditorialApprovalTargetType.content_variant) await prisma.contentVariant.update({ where: { id: target.id }, data: { status: ContentStatus.draft, updatedById: access.id } });
  if (target.type === EditorialApprovalTargetType.schedule) await prisma.contentSchedule.update({ where: { id: target.id }, data: { approvedById: null, status: ScheduleStatus.planned } });
}

export async function requestEditorialApproval(input: EditorialApprovalTarget & { comment?: string | null; access: UserAccess }) {
  const pending = await prisma.editorialApproval.findFirst({ where: { targetType: input.type, targetId: input.id, decision: EditorialApprovalDecision.pending } });
  if (pending) return pending;
  const approval = await prisma.editorialApproval.create({ data: { targetType: input.type, targetId: input.id, requestComment: input.comment || null, requestedById: input.access.id } });
  await createActionLog({ userId: input.access.id, actionType: "request_approval", targetType: input.type, targetId: input.id, summary: "Requested editorial approval", afterData: approval, source: "manual" });
  return approval;
}

export async function decideEditorialApproval(input: { approvalId: string; decision: EditorialApprovalDecision; comment?: string | null; access: UserAccess }) {
  const before = await prisma.editorialApproval.findUniqueOrThrow({ where: { id: input.approvalId } });
  if (before.decision !== EditorialApprovalDecision.pending) throw new Error("This approval request has already been decided.");
  if (input.decision === EditorialApprovalDecision.approved) {
    await assertApprovalReady({ type: before.targetType, id: before.targetId });
    await syncApprovedState({ type: before.targetType, id: before.targetId }, input.access);
  }
  const approval = await prisma.editorialApproval.update({ where: { id: before.id }, data: { decision: input.decision, decisionComment: input.comment || null, decidedById: input.access.id, decidedAt: new Date() } });
  await createActionLog({ userId: input.access.id, actionType: input.decision, targetType: before.targetType, targetId: before.targetId, summary: `Editorial approval ${input.decision.replaceAll("_", " ")}`, beforeData: before, afterData: approval, source: "manual" });
  return approval;
}

export async function revokeEditorialApproval(input: EditorialApprovalTarget & { comment?: string | null; access: UserAccess }) {
  const approved = await prisma.editorialApproval.findFirst({ where: { targetType: input.type, targetId: input.id, decision: EditorialApprovalDecision.approved }, orderBy: { createdAt: "desc" } });
  if (!approved) throw new Error("No active editorial approval was found.");
  await syncRevokedState(input, input.access);
  const result = await prisma.editorialApproval.update({ where: { id: approved.id }, data: { decision: EditorialApprovalDecision.revoked, decisionComment: input.comment || "Approval revoked", decidedById: input.access.id, decidedAt: new Date() } });
  await createActionLog({ userId: input.access.id, actionType: "revoke_approval", targetType: input.type, targetId: input.id, summary: "Revoked editorial approval", afterData: result, source: "manual" });
  return result;
}
