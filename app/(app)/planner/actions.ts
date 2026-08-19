"use server";

import { redirect } from "next/navigation";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { parseNullableDate, parseOptionalString, parseStringArray } from "@/lib/forms/parsers";
import { generateAiContentPlan, type GenerateAiContentPlanOptions } from "@/lib/planner/ai-plan-builder";

function parseItemCount(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPlanOptions(formData: FormData): GenerateAiContentPlanOptions {
  return {
    planningMode: parseOptionalString(formData.get("planningMode")),
    brand: parseOptionalString(formData.get("brand")),
    campaignName: parseOptionalString(formData.get("campaignName")),
    startDate: parseNullableDate(formData.get("startDate")),
    endDate: parseNullableDate(formData.get("endDate")),
    channels: parseStringArray(formData.get("channels")),
    itemCount: parseItemCount(formData.get("itemCount")),
    region: parseOptionalString(formData.get("region")),
    country: parseOptionalString(formData.get("country")),
    sport: parseOptionalString(formData.get("sport")),
    goal: parseOptionalString(formData.get("goal")),
    guidance: parseOptionalString(formData.get("guidance")),
  };
}

export async function generateAiContentPlanAction(formData: FormData) {
  const access = await requireApprovedUserAccess();
  const plan = await generateAiContentPlan(access, getPlanOptions(formData));

  redirect(`/plans/${plan.id}`);
}
