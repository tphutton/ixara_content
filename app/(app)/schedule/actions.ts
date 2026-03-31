"use server";

import { ScheduleStatus } from "@prisma/client";
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

export async function approveScheduleAction(id: string) {
  const access = await requireEditorialUserAccess();
  const before = await prisma.contentSchedule.findUniqueOrThrow({ where: { id } });

  const schedule = await prisma.contentSchedule.update({
    where: { id },
    data: {
      approvedById: access.id,
      status:
        before.status === ScheduleStatus.planned ? ScheduleStatus.ready : before.status,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "approve",
    targetType: "schedule",
    targetId: schedule.id,
    summary: "Approved schedule entry for publishing queue",
    beforeData: before,
    afterData: schedule,
    source: "manual",
  });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
}

export async function clearScheduleApprovalAction(id: string) {
  const access = await requireEditorialUserAccess();
  const before = await prisma.contentSchedule.findUniqueOrThrow({ where: { id } });

  const schedule = await prisma.contentSchedule.update({
    where: { id },
    data: {
      approvedById: null,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "schedule",
    targetId: schedule.id,
    summary: "Cleared schedule approval",
    beforeData: before,
    afterData: schedule,
    source: "manual",
  });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
}
