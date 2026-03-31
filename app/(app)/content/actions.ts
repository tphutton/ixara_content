"use server";

import { ContentStatus, ContentType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createActionLog } from "@/lib/actions/action-log";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { applyBrandRulesToContent } from "@/lib/brand-profiles/rules";
import { parseBoolean, parseOptionalString, parseStringArray } from "@/lib/forms/parsers";
import { prisma } from "@/lib/prisma";

function parseContentStatus(value: FormDataEntryValue | null) {
  return Object.values(ContentStatus).includes(value as ContentStatus)
    ? (value as ContentStatus)
    : ContentStatus.idea;
}

function parseContentType(value: FormDataEntryValue | null) {
  return Object.values(ContentType).includes(value as ContentType)
    ? (value as ContentType)
    : ContentType.social_post;
}

function getContentInput(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    body: parseOptionalString(formData.get("body")),
    hook: parseOptionalString(formData.get("hook")),
    cta: parseOptionalString(formData.get("cta")),
    contentType: parseContentType(formData.get("contentType")),
    platform: parseOptionalString(formData.get("platform")),
    status: parseContentStatus(formData.get("status")),
    campaignName: parseOptionalString(formData.get("campaignName")),
    brand: parseOptionalString(formData.get("brand")),
    sport: parseOptionalString(formData.get("sport")),
    region: parseOptionalString(formData.get("region")),
    country: parseOptionalString(formData.get("country")),
    tags: parseStringArray(formData.get("tags")),
    targetAudience: parseOptionalString(formData.get("targetAudience")),
    tone: parseOptionalString(formData.get("tone")),
    websites: parseStringArray(formData.get("websites")),
    assetImage: parseOptionalString(formData.get("assetImage")),
    assetCaption: parseOptionalString(formData.get("assetCaption")),
    primaryAssetId: parseOptionalString(formData.get("primaryAssetId")),
    aiGenerated: parseBoolean(formData.get("aiGenerated")),
    sourcePrompt: parseOptionalString(formData.get("sourcePrompt")),
  };
}

export async function createContentAction(formData: FormData) {
  const access = await requireApprovedUserAccess();
  const prepared = getContentInput(formData);

  if (!prepared.title) {
    throw new Error("Title is required.");
  }

  const { data, profile, warnings } = await applyBrandRulesToContent(prepared);

  const content = await prisma.content.create({
    data: {
      ...data,
      createdById: access.id,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "create",
    targetType: "content",
    targetId: content.id,
    summary: `Created content "${content.title}"${profile ? ` using ${profile.brandName} rules` : ""}${warnings.length > 0 ? ` with ${warnings.length} brand warning${warnings.length === 1 ? "" : "s"}` : ""}`,
    afterData: {
      ...content,
      brandProfileApplied: profile?.brandName ?? null,
      brandWarnings: warnings,
    },
    source: "manual",
  });

  revalidatePath("/content");
  redirect(`/content/${content.id}`);
}

export async function updateContentAction(id: string, formData: FormData) {
  const access = await requireApprovedUserAccess();
  const before = await prisma.content.findUniqueOrThrow({ where: { id } });
  const prepared = getContentInput(formData);

  if (!prepared.title) {
    throw new Error("Title is required.");
  }

  const { data, profile, warnings } = await applyBrandRulesToContent(prepared);

  const content = await prisma.content.update({
    where: { id },
    data: {
      ...data,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "content",
    targetId: content.id,
    summary: `Updated content "${content.title}"${profile ? ` using ${profile.brandName} rules` : ""}${warnings.length > 0 ? ` with ${warnings.length} brand warning${warnings.length === 1 ? "" : "s"}` : ""}`,
    beforeData: before,
    afterData: {
      ...content,
      brandProfileApplied: profile?.brandName ?? null,
      brandWarnings: warnings,
    },
    source: "manual",
  });

  revalidatePath("/content");
  revalidatePath(`/content/${id}`);
}

export async function deleteContentAction(id: string) {
  const access = await requireApprovedUserAccess();
  const before = await prisma.content.findUniqueOrThrow({ where: { id } });

  await prisma.content.delete({ where: { id } });

  await createActionLog({
    userId: access.id,
    actionType: "delete",
    targetType: "content",
    targetId: id,
    summary: `Deleted content "${before.title}"`,
    beforeData: before,
    source: "manual",
  });

  revalidatePath("/content");
  redirect("/content");
}
