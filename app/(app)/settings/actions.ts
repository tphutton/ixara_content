"use server";

import { revalidatePath } from "next/cache";
import { createActionLog } from "@/lib/actions/action-log";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { parseOptionalString, parseStringArray } from "@/lib/forms/parsers";
import { prisma } from "@/lib/prisma";

function getBrandProfileInput(formData: FormData) {
  return {
    brandName: String(formData.get("brandName") ?? "").trim(),
    description: parseOptionalString(formData.get("description")),
    defaultTone: parseOptionalString(formData.get("defaultTone")),
    targetAudience: parseOptionalString(formData.get("targetAudience")),
    preferredWebsites: parseStringArray(formData.get("preferredWebsites")),
    sports: parseStringArray(formData.get("sports")),
    regions: parseStringArray(formData.get("regions")),
    countries: parseStringArray(formData.get("countries")),
    bannedPhrases: parseStringArray(formData.get("bannedPhrases")),
    preferredCTAs: parseStringArray(formData.get("preferredCTAs")),
  };
}

export async function createBrandProfileAction(formData: FormData) {
  const access = await requireApprovedUserAccess();
  const data = getBrandProfileInput(formData);

  if (!data.brandName) {
    throw new Error("Brand name is required.");
  }

  const profile = await prisma.brandProfile.create({ data });

  await createActionLog({
    userId: access.id,
    actionType: "create",
    targetType: "brand_profile",
    targetId: profile.id,
    summary: `Created brand profile "${profile.brandName}"`,
    afterData: profile,
    source: "manual",
  });

  revalidatePath("/settings");
}

export async function updateBrandProfileAction(id: string, formData: FormData) {
  const access = await requireApprovedUserAccess();
  const data = getBrandProfileInput(formData);

  if (!data.brandName) {
    throw new Error("Brand name is required.");
  }

  const before = await prisma.brandProfile.findUniqueOrThrow({ where: { id } });
  const profile = await prisma.brandProfile.update({
    where: { id },
    data,
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "brand_profile",
    targetId: profile.id,
    summary: `Updated brand profile "${profile.brandName}"`,
    beforeData: before,
    afterData: profile,
    source: "manual",
  });

  revalidatePath("/settings");
}

export async function deleteBrandProfileAction(id: string) {
  const access = await requireApprovedUserAccess();
  const before = await prisma.brandProfile.findUniqueOrThrow({ where: { id } });

  await prisma.brandProfile.delete({ where: { id } });

  await createActionLog({
    userId: access.id,
    actionType: "delete",
    targetType: "brand_profile",
    targetId: id,
    summary: `Deleted brand profile "${before.brandName}"`,
    beforeData: before,
    source: "manual",
  });

  revalidatePath("/settings");
}
