"use server";

import { redirect } from "next/navigation";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { generateAiContentPlan } from "@/lib/planner/ai-plan-builder";

export async function generateAiContentPlanAction() {
  const access = await requireApprovedUserAccess();
  const plan = await generateAiContentPlan(access);

  redirect(`/plans/${plan.id}`);
}
