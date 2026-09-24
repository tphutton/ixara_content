"use server";

import { EditorialApprovalDecision, EditorialApprovalTargetType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireEditorialUserAccess } from "@/lib/auth/user-access";
import { decideEditorialApproval, requestEditorialApproval, revokeEditorialApproval } from "@/lib/approvals/editorial-approvals";

function refresh(path: string) {
  revalidatePath(path);
  revalidatePath("/plans");
  revalidatePath("/content");
  revalidatePath("/blogs");
  revalidatePath("/schedule");
  revalidatePath("/publishing");
}

export async function requestEditorialApprovalAction(type: EditorialApprovalTargetType, id: string, path: string, formData: FormData) {
  const access = await requireEditorialUserAccess();
  await requestEditorialApproval({ type, id, access, comment: String(formData.get("comment") ?? "").trim() || null });
  refresh(path);
}

export async function decideEditorialApprovalAction(approvalId: string, path: string, formData: FormData) {
  const access = await requireEditorialUserAccess();
  const raw = String(formData.get("decision") ?? "");
  const decision = raw === "approved" ? EditorialApprovalDecision.approved : raw === "rejected" ? EditorialApprovalDecision.rejected : EditorialApprovalDecision.changes_requested;
  await decideEditorialApproval({ approvalId, decision, access, comment: String(formData.get("comment") ?? "").trim() || null });
  refresh(path);
}

export async function revokeEditorialApprovalAction(type: EditorialApprovalTargetType, id: string, path: string, formData: FormData) {
  const access = await requireEditorialUserAccess();
  await revokeEditorialApproval({ type, id, access, comment: String(formData.get("comment") ?? "").trim() || null });
  refresh(path);
}
