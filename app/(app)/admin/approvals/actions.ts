"use server";

import { ApprovalStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  isApprovalStatus,
  isUserRole,
  requireAdminUserAccess,
} from "@/lib/auth/user-access";
import { prisma } from "@/lib/prisma";

export async function updateUserAccessAction(formData: FormData) {
  const admin = await requireAdminUserAccess();
  const userId = formData.get("userId");
  const role = formData.get("role");
  const approvalStatus = formData.get("approvalStatus");

  if (typeof userId !== "string" || !isUserRole(role) || !isApprovalStatus(approvalStatus)) {
    throw new Error("Invalid approval payload.");
  }

  const targetUser = await prisma.userAccess.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    throw new Error("User not found.");
  }

  if (targetUser.id === admin.id && approvalStatus !== ApprovalStatus.approved) {
    throw new Error("The active admin cannot revoke their own approved access.");
  }

  await prisma.userAccess.update({
    where: { id: userId },
    data: {
      role,
      approvalStatus,
    },
  });

  revalidatePath("/admin/approvals");
}
