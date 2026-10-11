"use server";

import { revalidatePath } from "next/cache";
import { createEditorialComment, resolveEditorialComment } from "@/lib/editorial/record-history";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";

export async function addContentEditorialComment(contentId: string, formData: FormData) {
  const access = await requireApprovedUserAccess();
  await createEditorialComment({
    targetType: String(formData.get("targetType") ?? "content"),
    targetId: String(formData.get("targetId") ?? contentId),
    body: String(formData.get("body") ?? ""),
    sectionKey: String(formData.get("sectionKey") ?? "").trim() || null,
    fieldKey: String(formData.get("fieldKey") ?? "").trim() || null,
    isChangeRequest: formData.get("isChangeRequest") === "on",
    createdById: access.id,
  });
  revalidatePath(`/content/${contentId}`);
}

export async function resolveContentEditorialComment(contentId: string, commentId: string) {
  const access = await requireApprovedUserAccess();
  await resolveEditorialComment(commentId, access.id);
  revalidatePath(`/content/${contentId}`);
}
