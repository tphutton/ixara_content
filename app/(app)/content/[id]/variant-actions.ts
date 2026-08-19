"use server";

import { revalidatePath } from "next/cache";
import { createActionLog } from "@/lib/actions/action-log";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { generateContentVariants } from "@/lib/content-variants/generate";
import { prisma } from "@/lib/prisma";

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
