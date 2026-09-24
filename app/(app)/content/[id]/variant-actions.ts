"use server";

import { revalidatePath } from "next/cache";
import { createActionLog } from "@/lib/actions/action-log";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { generateContentVariants } from "@/lib/content-variants/generate";
import { prisma } from "@/lib/prisma";

function optional(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function generateContentVariantsAction(id: string) {
  const access = await requireApprovedUserAccess();
  await generateContentVariants({
    contentId: id,
    access,
    source: "manual",
  });

  revalidatePath(`/content/${id}`);
}

export async function deleteContentVariantAction(contentId: string, variantId: string) {
  const access = await requireApprovedUserAccess();
  const before = await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } });

  await prisma.contentVariant.delete({ where: { id: variantId } });

  await createActionLog({
    userId: access.id,
    actionType: "delete",
    targetType: "content_variant",
    targetId: variantId,
    summary: `Deleted ${before.platform} variant "${before.title}"`,
    beforeData: before,
    source: "manual",
  });

  revalidatePath(`/content/${contentId}`);
}

export async function updateContentVariantAction(contentId: string, variantId: string, formData: FormData) {
  const access = await requireApprovedUserAccess();
  const before = await prisma.contentVariant.findFirstOrThrow({ where: { id: variantId, contentId } });
  const title = optional(formData.get("title"));
  if (!title) throw new Error("Variant title is required.");

  const variant = await prisma.contentVariant.update({
    where: { id: variantId },
    data: {
      title,
      platform: optional(formData.get("platform")) ?? before.platform,
      hook: optional(formData.get("hook")),
      body: optional(formData.get("body")),
      cta: optional(formData.get("cta")),
      notes: optional(formData.get("notes")),
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "content_variant",
    targetId: variantId,
    summary: `Updated ${variant.platform} variant "${variant.title}"`,
    beforeData: before,
    afterData: variant,
    source: "manual",
  });

  revalidatePath(`/content/${contentId}`);
}

export async function selectContentVariantAction(contentId: string, variantId: string) {
  const access = await requireApprovedUserAccess();
  const variant = await prisma.contentVariant.findFirstOrThrow({ where: { id: variantId, contentId } });

  const content = await prisma.content.update({
    where: { id: contentId },
    data: { selectedVariantId: variant.id, updatedById: access.id },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "content",
    targetId: contentId,
    summary: `Selected ${variant.platform} variant "${variant.title}" for publishing`,
    afterData: { selectedVariantId: variant.id, contentId: content.id },
    source: "manual",
  });

  revalidatePath(`/content/${contentId}`);
  revalidatePath("/publishing");
  revalidatePath("/schedule");
}
