"use server";

import { EditorialApprovalDecision, EditorialApprovalTargetType, ScheduleStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createActionLog } from "@/lib/actions/action-log";
import {
  requireEditorialUserAccess,
} from "@/lib/auth/user-access";
import {
  parseOptionalString,
  parseRequiredDate,
} from "@/lib/forms/parsers";
import { prisma } from "@/lib/prisma";
import { publishScheduleToMeta } from "@/lib/social/meta-publish";
import { decideEditorialApproval, requestEditorialApproval, revokeEditorialApproval } from "@/lib/approvals/editorial-approvals";

type BulkScheduleActionState = {
  error: string | null;
  success: string | null;
};

function parseScheduleStatus(value: FormDataEntryValue | null) {
  return Object.values(ScheduleStatus).includes(value as ScheduleStatus)
    ? (value as ScheduleStatus)
    : ScheduleStatus.planned;
}

function getScheduleInput(formData: FormData) {
  const contentId = parseOptionalString(formData.get("contentId"));
  const blogId = parseOptionalString(formData.get("blogId"));

  if (!contentId && !blogId) {
    throw new Error("A schedule entry must link to content or a blog.");
  }

  return {
    contentId,
    blogId,
    scheduledFor: parseRequiredDate(formData.get("scheduledFor")),
    channel: parseOptionalString(formData.get("channel")),
    platformAccount: parseOptionalString(formData.get("platformAccount")),
    status: parseScheduleStatus(formData.get("status")),
    campaignName: parseOptionalString(formData.get("campaignName")),
    priority: parseOptionalString(formData.get("priority")),
    notes: parseOptionalString(formData.get("notes")),
    brand: parseOptionalString(formData.get("brand")),
    sport: parseOptionalString(formData.get("sport")),
    region: parseOptionalString(formData.get("region")),
    country: parseOptionalString(formData.get("country")),
  };
}

function parseBulkScheduleIds(formData: FormData) {
  return formData
    .getAll("scheduleIds")
    .map((value) => parseOptionalString(value))
    .filter((value): value is string => Boolean(value));
}

function parseBulkApprovalAction(value: FormDataEntryValue | null) {
  return value === "approve" || value === "clear" ? value : "none";
}

export async function createScheduleAction(formData: FormData) {
  const access = await requireEditorialUserAccess();
  const data = getScheduleInput(formData);

  const linkedContent = data.contentId
    ? await prisma.content.findUnique({
        where: { id: data.contentId },
        select: { brand: true, sport: true, region: true, country: true },
      })
    : null;
  const linkedBlog = data.blogId
    ? await prisma.blog.findUnique({
        where: { id: data.blogId },
        select: { brand: true, sport: true, region: true, country: true },
      })
    : null;

  const schedule = await prisma.contentSchedule.create({
    data: {
      ...data,
      brand: data.brand ?? linkedContent?.brand ?? linkedBlog?.brand ?? null,
      sport: data.sport ?? linkedContent?.sport ?? linkedBlog?.sport ?? null,
      region: data.region ?? linkedContent?.region ?? linkedBlog?.region ?? null,
      country: data.country ?? linkedContent?.country ?? linkedBlog?.country ?? null,
      createdById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "create",
    targetType: "schedule",
    targetId: schedule.id,
    summary: "Created schedule entry",
    afterData: schedule,
    source: "manual",
  });

  revalidatePath("/schedule");
  redirect(`/schedule/${schedule.id}`);
}

export async function updateScheduleAction(id: string, formData: FormData) {
  const access = await requireEditorialUserAccess();
  const before = await prisma.contentSchedule.findUniqueOrThrow({ where: { id } });
  const data = getScheduleInput(formData);

  const linkedContent = data.contentId
    ? await prisma.content.findUnique({
        where: { id: data.contentId },
        select: { brand: true, sport: true, region: true, country: true },
      })
    : null;
  const linkedBlog = data.blogId
    ? await prisma.blog.findUnique({
        where: { id: data.blogId },
        select: { brand: true, sport: true, region: true, country: true },
      })
    : null;

  const schedule = await prisma.contentSchedule.update({
    where: { id },
    data: {
      ...data,
      brand: data.brand ?? linkedContent?.brand ?? linkedBlog?.brand ?? null,
      sport: data.sport ?? linkedContent?.sport ?? linkedBlog?.sport ?? null,
      region: data.region ?? linkedContent?.region ?? linkedBlog?.region ?? null,
      country: data.country ?? linkedContent?.country ?? linkedBlog?.country ?? null,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "schedule",
    targetId: schedule.id,
    summary: "Updated schedule entry",
    beforeData: before,
    afterData: schedule,
    source: "manual",
  });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
}

export async function deleteScheduleAction(id: string) {
  const access = await requireEditorialUserAccess();
  const before = await prisma.contentSchedule.findUniqueOrThrow({ where: { id } });

  await prisma.contentSchedule.delete({ where: { id } });

  await createActionLog({
    userId: access.id,
    actionType: "delete",
    targetType: "schedule",
    targetId: id,
    summary: "Deleted schedule entry",
    beforeData: before,
    source: "manual",
  });

  revalidatePath("/schedule");
  redirect("/schedule");
}

export async function approveScheduleAction(id: string, formData?: FormData) {
  const access = await requireEditorialUserAccess();
  const approval = await requestEditorialApproval({ type: EditorialApprovalTargetType.schedule, id, access, comment: formData ? String(formData.get("comment") ?? "") : null });
  await decideEditorialApproval({ approvalId: approval.id, decision: EditorialApprovalDecision.approved, access });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
}

export async function clearScheduleApprovalAction(id: string) {
  const access = await requireEditorialUserAccess();
  await revokeEditorialApproval({ type: EditorialApprovalTargetType.schedule, id, access });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
}

export async function publishScheduleToMetaAction(id: string) {
  const access = await requireEditorialUserAccess();
  const publishedPost = await publishScheduleToMeta({
    scheduleId: id,
    access,
  });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
  if (publishedPost.contentId) revalidatePath(`/content/${publishedPost.contentId}`);
  if (publishedPost.blogId) revalidatePath(`/blogs/${publishedPost.blogId}`);
  revalidatePath("/analytics");
}

export async function bulkUpdateScheduleAction(
  _previousState: BulkScheduleActionState,
  formData: FormData,
): Promise<BulkScheduleActionState> {
  const access = await requireEditorialUserAccess();
  const scheduleIds = parseBulkScheduleIds(formData);

  if (scheduleIds.length === 0) {
    return {
      error: "Select at least one schedule entry first.",
      success: null,
    };
  }

  const scheduledForInput = parseOptionalString(formData.get("scheduledFor"));
  const statusInput = parseOptionalString(formData.get("status"));
  const channel = parseOptionalString(formData.get("channel"));
  const platformAccount = parseOptionalString(formData.get("platformAccount"));
  const brand = parseOptionalString(formData.get("brand"));
  const approvalAction = parseBulkApprovalAction(formData.get("approvalAction"));

  const data: {
    scheduledFor?: Date;
    status?: ScheduleStatus;
    channel?: string | null;
    platformAccount?: string | null;
    brand?: string | null;
    approvedById?: string | null;
  } = {};

  if (formData.has("applyScheduledFor")) {
    if (!scheduledForInput) {
      return {
        error: "Choose a scheduled date and time before applying it in bulk.",
        success: null,
      };
    }

    const parsed = new Date(scheduledForInput);

    if (Number.isNaN(parsed.getTime())) {
      return {
        error: "Enter a valid scheduled date and time.",
        success: null,
      };
    }

    data.scheduledFor = parsed;
  }

  if (formData.has("applyStatus")) {
    if (!statusInput) {
      return {
        error: "Choose a status before applying it in bulk.",
        success: null,
      };
    }

    if (!Object.values(ScheduleStatus).includes(statusInput as ScheduleStatus)) {
      return {
        error: "Choose a valid status before applying the bulk update.",
        success: null,
      };
    }

    data.status = statusInput as ScheduleStatus;
  }

  if (formData.has("applyChannel")) {
    data.channel = channel;
  }

  if (formData.has("applyPlatformAccount")) {
    data.platformAccount = platformAccount;
  }

  if (formData.has("applyBrand")) {
    data.brand = brand;
  }

  if (Object.keys(data).length === 0 && approvalAction === "none") {
    return {
      error: "Choose at least one field to update.",
      success: null,
    };
  }

  const beforeRows = await prisma.contentSchedule.findMany({
    where: { id: { in: scheduleIds } },
  });

  if (Object.keys(data).length > 0) {
    await prisma.contentSchedule.updateMany({ where: { id: { in: scheduleIds } }, data });
  }

  for (const scheduleId of scheduleIds) {
    if (approvalAction === "approve") {
      const approval = await requestEditorialApproval({ type: EditorialApprovalTargetType.schedule, id: scheduleId, access, comment: "Bulk schedule approval" });
      await decideEditorialApproval({ approvalId: approval.id, decision: EditorialApprovalDecision.approved, access });
    }
    if (approvalAction === "clear") {
      await revokeEditorialApproval({ type: EditorialApprovalTargetType.schedule, id: scheduleId, access, comment: "Bulk approval cleared" });
    }
  }

  await Promise.all(
    beforeRows.map((beforeRow) =>
      createActionLog({
        userId: access.id,
        actionType: "update",
        targetType: "schedule",
        targetId: beforeRow.id,
        summary: `Bulk updated schedule entry (${scheduleIds.length} selected)`,
        beforeData: beforeRow,
        afterData: {
          ...beforeRow,
          ...data,
        },
        source: "manual",
      }),
    ),
  );

  revalidatePath("/schedule");

  return {
    error: null,
    success: `Updated ${scheduleIds.length} schedule entr${scheduleIds.length === 1 ? "y" : "ies"}.`,
  };
}
