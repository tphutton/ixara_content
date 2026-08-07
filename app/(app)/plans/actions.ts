"use server";

import {
  ContentPlanItemStatus,
  ContentPlanItemType,
  ContentPlanStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createActionLog } from "@/lib/actions/action-log";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { parseNullableDate, parseOptionalString } from "@/lib/forms/parsers";
import { prisma } from "@/lib/prisma";

function parsePlanStatus(value: FormDataEntryValue | null) {
  return Object.values(ContentPlanStatus).includes(value as ContentPlanStatus)
    ? (value as ContentPlanStatus)
    : ContentPlanStatus.draft;
}

function parsePlanItemStatus(value: FormDataEntryValue | null) {
  return Object.values(ContentPlanItemStatus).includes(value as ContentPlanItemStatus)
    ? (value as ContentPlanItemStatus)
    : ContentPlanItemStatus.planned;
}

function parsePlanItemType(value: FormDataEntryValue | null) {
  return Object.values(ContentPlanItemType).includes(value as ContentPlanItemType)
    ? (value as ContentPlanItemType)
    : ContentPlanItemType.content;
}

function getPlanInput(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: parseOptionalString(formData.get("description")),
    goal: parseOptionalString(formData.get("goal")),
    status: parsePlanStatus(formData.get("status")),
    startDate: parseNullableDate(formData.get("startDate")),
    endDate: parseNullableDate(formData.get("endDate")),
    brand: parseOptionalString(formData.get("brand")),
    campaignName: parseOptionalString(formData.get("campaignName")),
    sourcePrompt: parseOptionalString(formData.get("sourcePrompt")),
  };
}

function getPlanItemInput(formData: FormData) {
  return {
    itemType: parsePlanItemType(formData.get("itemType")),
    status: parsePlanItemStatus(formData.get("status")),
    title: String(formData.get("title") ?? "").trim(),
    brief: parseOptionalString(formData.get("brief")),
    channel: parseOptionalString(formData.get("channel")),
    scheduledFor: parseNullableDate(formData.get("scheduledFor")),
    brand: parseOptionalString(formData.get("brand")),
    sport: parseOptionalString(formData.get("sport")),
    region: parseOptionalString(formData.get("region")),
    country: parseOptionalString(formData.get("country")),
    campaignName: parseOptionalString(formData.get("campaignName")),
    assetRequest: parseOptionalString(formData.get("assetRequest")),
  };
}

export async function createContentPlanAction(formData: FormData) {
  const access = await requireApprovedUserAccess();
  const data = getPlanInput(formData);

  if (!data.title) {
    throw new Error("Plan title is required.");
  }

  const plan = await prisma.contentPlan.create({
    data: {
      ...data,
      createdById: access.id,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "create",
    targetType: "content_plan",
    targetId: plan.id,
    summary: `Created content plan "${plan.title}"`,
    afterData: plan,
    source: "manual",
  });

  revalidatePath("/plans");
  redirect(`/plans/${plan.id}`);
}

export async function updateContentPlanAction(id: string, formData: FormData) {
  const access = await requireApprovedUserAccess();
  const before = await prisma.contentPlan.findUniqueOrThrow({ where: { id } });
  const data = getPlanInput(formData);

  if (!data.title) {
    throw new Error("Plan title is required.");
  }

  const plan = await prisma.contentPlan.update({
    where: { id },
    data: {
      ...data,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "content_plan",
    targetId: plan.id,
    summary: `Updated content plan "${plan.title}"`,
    beforeData: before,
    afterData: plan,
    source: "manual",
  });

  revalidatePath("/plans");
  revalidatePath(`/plans/${id}`);
}

export async function addContentPlanItemAction(planId: string, formData: FormData) {
  const access = await requireApprovedUserAccess();
  const plan = await prisma.contentPlan.findUniqueOrThrow({
    where: { id: planId },
    include: { _count: { select: { items: true } } },
  });
  const data = getPlanItemInput(formData);

  if (!data.title) {
    throw new Error("Item title is required.");
  }

  const item = await prisma.contentPlanItem.create({
    data: {
      ...data,
      planId,
      brand: data.brand ?? plan.brand,
      campaignName: data.campaignName ?? plan.campaignName,
      sortOrder: plan._count.items,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "create",
    targetType: "content_plan_item",
    targetId: item.id,
    summary: `Added "${item.title}" to plan "${plan.title}"`,
    afterData: item,
    source: "manual",
  });

  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
}

export async function updateContentPlanItemStatusAction(
  planId: string,
  itemId: string,
  formData: FormData,
) {
  const access = await requireApprovedUserAccess();
  const status = parsePlanItemStatus(formData.get("status"));
  const before = await prisma.contentPlanItem.findUniqueOrThrow({ where: { id: itemId } });
  const item = await prisma.contentPlanItem.update({
    where: { id: itemId },
    data: { status },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "content_plan_item",
    targetId: item.id,
    summary: `Moved plan item "${item.title}" to ${item.status}`,
    beforeData: before,
    afterData: item,
    source: "manual",
  });

  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
}
