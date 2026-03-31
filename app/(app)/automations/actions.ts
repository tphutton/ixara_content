"use server";

import {
  AutomationFrequency,
  AutomationStatus,
  AutomationType,
  ContentStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createActionLog } from "@/lib/actions/action-log";
import { runWeeklySocialAutomation } from "@/lib/automation/generate-weekly-social";
import { runDueAutomations } from "@/lib/automation/runner";
import { calculateNextAutomationRun } from "@/lib/automation/schedule";
import { requireEditorialUserAccess } from "@/lib/auth/user-access";
import { parseOptionalString, parseStringArray } from "@/lib/forms/parsers";
import { prisma } from "@/lib/prisma";

function parseEnum<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function getAutomationInput(formData: FormData) {
  const frequency = parseEnum(
    formData.get("frequency"),
    Object.values(AutomationFrequency),
    AutomationFrequency.weekly,
  );
  const dayOfWeekValue = parseOptionalString(formData.get("dayOfWeek"));
  const runTime = parseOptionalString(formData.get("runTime"));
  const timezone = parseOptionalString(formData.get("timezone")) ?? "Asia/Bangkok";

  return {
    name: String(formData.get("name") ?? "").trim(),
    type: parseEnum(
      formData.get("type"),
      Object.values(AutomationType),
      AutomationType.weekly_social_content,
    ),
    status: parseEnum(
      formData.get("status"),
      Object.values(AutomationStatus),
      AutomationStatus.draft,
    ),
    frequency,
    description: parseOptionalString(formData.get("description")),
    promptTemplate: parseOptionalString(formData.get("promptTemplate")),
    brandProfileId: parseOptionalString(formData.get("brandProfileId")),
    brandName: parseOptionalString(formData.get("brandName")),
    targetContentStatus: parseEnum(
      formData.get("targetContentStatus"),
      Object.values(ContentStatus),
      ContentStatus.draft,
    ),
    itemCount: Math.max(1, Math.min(12, Number(formData.get("itemCount") ?? 5) || 5)),
    dayOfWeek: dayOfWeekValue !== null ? Number(dayOfWeekValue) : null,
    runTime,
    timezone,
    channels: parseStringArray(formData.get("channels")),
    platforms: parseStringArray(formData.get("platforms")),
    region: parseOptionalString(formData.get("region")),
    country: parseOptionalString(formData.get("country")),
    sport: parseOptionalString(formData.get("sport")),
    nextRunAt: calculateNextAutomationRun({
      frequency,
      dayOfWeek: dayOfWeekValue !== null ? Number(dayOfWeekValue) : null,
      runTime,
      timezone,
    }),
  };
}

export async function createAutomationAction(formData: FormData) {
  const access = await requireEditorialUserAccess();
  const data = getAutomationInput(formData);

  if (!data.name) {
    throw new Error("Automation name is required.");
  }

  const workflow = await prisma.automationWorkflow.create({
    data: {
      ...data,
      createdById: access.id,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "create",
    targetType: "automation",
    targetId: workflow.id,
    summary: `Created automation "${workflow.name}"`,
    afterData: workflow,
    source: "manual",
  });

  revalidatePath("/automations");
  redirect(`/automations/${workflow.id}`);
}

export async function updateAutomationAction(id: string, formData: FormData) {
  const access = await requireEditorialUserAccess();
  const before = await prisma.automationWorkflow.findUniqueOrThrow({ where: { id } });
  const data = getAutomationInput(formData);

  if (!data.name) {
    throw new Error("Automation name is required.");
  }

  const workflow = await prisma.automationWorkflow.update({
    where: { id },
    data: {
      ...data,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "automation",
    targetId: workflow.id,
    summary: `Updated automation "${workflow.name}"`,
    beforeData: before,
    afterData: workflow,
    source: "manual",
  });

  revalidatePath("/automations");
  revalidatePath(`/automations/${id}`);
}

export async function deleteAutomationAction(id: string) {
  const access = await requireEditorialUserAccess();
  const before = await prisma.automationWorkflow.findUniqueOrThrow({ where: { id } });

  await prisma.automationWorkflow.delete({ where: { id } });

  await createActionLog({
    userId: access.id,
    actionType: "delete",
    targetType: "automation",
    targetId: id,
    summary: `Deleted automation "${before.name}"`,
    beforeData: before,
    source: "manual",
  });

  revalidatePath("/automations");
  redirect("/automations");
}

export async function runAutomationNowAction(id: string) {
  const access = await requireEditorialUserAccess();
  const workflow = await prisma.automationWorkflow.findUniqueOrThrow({ where: { id } });

  if (workflow.type !== AutomationType.weekly_social_content) {
    throw new Error("Unsupported automation type.");
  }

  await runWeeklySocialAutomation({
    workflow,
    triggeredBy: access,
  });

  revalidatePath("/automations");
  revalidatePath(`/automations/${id}`);
  revalidatePath("/content");
  revalidatePath("/dashboard");
}

export async function toggleAutomationStatusAction(id: string) {
  const access = await requireEditorialUserAccess();
  const workflow = await prisma.automationWorkflow.findUniqueOrThrow({ where: { id } });
  const nextStatus =
    workflow.status === AutomationStatus.active ? AutomationStatus.paused : AutomationStatus.active;

  const updated = await prisma.automationWorkflow.update({
    where: { id },
    data: {
      status: nextStatus,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "automation",
    targetId: updated.id,
    summary: `${nextStatus === AutomationStatus.active ? "Activated" : "Paused"} automation "${updated.name}"`,
    afterData: updated,
    source: "manual",
  });

  revalidatePath("/automations");
  revalidatePath(`/automations/${id}`);
}

export async function runDueAutomationsAction() {
  await requireEditorialUserAccess();

  await runDueAutomations();

  revalidatePath("/automations");
  revalidatePath("/dashboard");
  revalidatePath("/content");
}
