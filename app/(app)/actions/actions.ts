"use server";

import { revalidatePath } from "next/cache";
import { executeQuillActionProposal, rejectQuillActionProposal } from "@/lib/ai/action-proposals";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";

export async function approveQuillAction(id: string) {
  const access = await requireApprovedUserAccess();
  await executeQuillActionProposal(id, access);
  revalidatePath("/actions");
  revalidatePath("/chat");
}

export async function rejectQuillAction(id: string) {
  const access = await requireApprovedUserAccess();
  await rejectQuillActionProposal(id, access);
  revalidatePath("/actions");
  revalidatePath("/chat");
}
