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
    positioning: parseOptionalString(formData.get("positioning")),
    defaultTone: parseOptionalString(formData.get("defaultTone")),
    targetAudience: parseOptionalString(formData.get("targetAudience")),
    preferredWebsites: parseStringArray(formData.get("preferredWebsites")),
    sports: parseStringArray(formData.get("sports")),
    regions: parseStringArray(formData.get("regions")),
    countries: parseStringArray(formData.get("countries")),
    contentPillars: parseStringArray(formData.get("contentPillars")),
    audiencePersonas: parseStringArray(formData.get("audiencePersonas")),
    keyOffers: parseStringArray(formData.get("keyOffers")),
    proofPoints: parseStringArray(formData.get("proofPoints")),
    seoKeywords: parseStringArray(formData.get("seoKeywords")),
    competitors: parseStringArray(formData.get("competitors")),
    voiceExamples: parseStringArray(formData.get("voiceExamples")),
    visualGuidelines: parseOptionalString(formData.get("visualGuidelines")),
    instagramGuidelines: parseOptionalString(formData.get("instagramGuidelines")),
    facebookGuidelines: parseOptionalString(formData.get("facebookGuidelines")),
    linkedinGuidelines: parseOptionalString(formData.get("linkedinGuidelines")),
    blogGuidelines: parseOptionalString(formData.get("blogGuidelines")),
    emailGuidelines: parseOptionalString(formData.get("emailGuidelines")),
    adGuidelines: parseOptionalString(formData.get("adGuidelines")),
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
  revalidatePath("/brands");
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
  revalidatePath("/brands");
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
  revalidatePath("/brands");
}

export async function addBrandKitReferenceAction(brandProfileId: string, formData: FormData) {
  const { requireEditorialUserAccess } = await import("@/lib/auth/user-access");
  const access = await requireEditorialUserAccess();
  const assetId = String(formData.get("assetId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  const notes = parseOptionalString(formData.get("notes"));
  const roles = ["character", "prop", "style", "logo", "voice", "music", "other"];
  if (!assetId || !roles.includes(role) || !["draft", "approved", "retired"].includes(status)) throw new Error("Choose a valid asset, role and status.");
  await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandProfileId } });
  await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  const reference = await prisma.brandKitReference.create({ data: { brandProfileId, assetId, role, status, notes } });
  await createActionLog({ userId: access.id, actionType: "create", targetType: "brand_kit_reference", targetId: reference.id, summary: "Added brand kit reference", afterData: reference, source: "manual" });
  revalidatePath("/brands");
}

export async function removeBrandKitReferenceAction(id: string) {
  const { requireEditorialUserAccess } = await import("@/lib/auth/user-access");
  const access = await requireEditorialUserAccess();
  const before = await prisma.brandKitReference.delete({ where: { id } });
  await createActionLog({ userId: access.id, actionType: "delete", targetType: "brand_kit_reference", targetId: id, summary: "Removed brand kit reference (asset retained)", beforeData: before, source: "manual" });
  revalidatePath("/brands");
}

export async function updateBrandKitReferenceAction(id: string, formData: FormData) {
  const { requireEditorialUserAccess } = await import("@/lib/auth/user-access");
  const access = await requireEditorialUserAccess();
  const status = String(formData.get("status") ?? "");
  if (!["draft", "approved", "retired"].includes(status)) throw new Error("Invalid reference status.");
  const before = await prisma.brandKitReference.findUniqueOrThrow({ where: { id } });
  const after = await prisma.brandKitReference.update({ where: { id }, data: { status, notes: parseOptionalString(formData.get("notes")) } });
  await createActionLog({ userId: access.id, actionType: "update", targetType: "brand_kit_reference", targetId: id, summary: "Updated brand kit reference", beforeData: before, afterData: after, source: "manual" });
  revalidatePath("/brands");
}


// Manual and plugin edits share the same validation and audit workflow.
async function applyCharacterOperation(name: string, args: Record<string, string>) {
  const { requireEditorialUserAccess } = await import("@/lib/auth/user-access");
  const { brandCharacterOperations } = await import("@/lib/mcp/brand-character-operations");
  const { withMcpTransaction } = await import("@/lib/mcp/transaction");
  const access = await requireEditorialUserAccess();
  const operation = brandCharacterOperations.find(item => item.name === name);
  if (!operation) throw new Error("Character operation unavailable.");
  await prisma.$transaction(tx => withMcpTransaction(tx, async () => {
    if (operation.guard) await operation.guard(args, tx);
    await operation.run(args, { ...access, source: "manual" });
  }), { isolationLevel: "Serializable" });
  revalidatePath("/brands");
}

export async function createBrandCharacterAction(brandProfileId: string, formData: FormData) {
  await applyCharacterOperation("create_brand_character", {
    brandProfileId,
    referenceAssetId: String(formData.get("referenceAssetId") ?? ""),
    name: String(formData.get("name") ?? ""),
    personality: String(formData.get("personality") ?? ""),
    voiceDescription: String(formData.get("voiceDescription") ?? ""),
  });
}

export async function updateBrandCharacterAction(id: string, formData: FormData) {
  await applyCharacterOperation("update_brand_character", {
    id,
    referenceAssetId: String(formData.get("referenceAssetId") ?? ""),
    name: String(formData.get("name") ?? ""),
    personality: String(formData.get("personality") ?? ""),
    voiceDescription: String(formData.get("voiceDescription") ?? ""),
  });
}
