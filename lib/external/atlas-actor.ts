import { ApprovalStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ATLAS_CLERK_USER_ID = "atlas-command-center";
const ATLAS_EMAIL = "atlas@ixara.tech";

/**
 * System actor used when Atlas / MCP calls content.ixara.tech write APIs.
 * Replaces Quill as the AI operator identity for automated content ops.
 */
export async function getOrCreateAtlasActor() {
  const existing = await prisma.userAccess.findUnique({
    where: { clerkUserId: ATLAS_CLERK_USER_ID },
  });

  if (existing) {
    if (
      existing.approvalStatus !== ApprovalStatus.approved
      || existing.role !== UserRole.admin
    ) {
      return prisma.userAccess.update({
        where: { id: existing.id },
        data: {
          approvalStatus: ApprovalStatus.approved,
          role: UserRole.admin,
          fullName: "Atlas",
        },
      });
    }
    return existing;
  }

  const byEmail = await prisma.userAccess.findUnique({
    where: { email: ATLAS_EMAIL },
  });

  if (byEmail) {
    return prisma.userAccess.update({
      where: { id: byEmail.id },
      data: {
        clerkUserId: ATLAS_CLERK_USER_ID,
        fullName: "Atlas",
        approvalStatus: ApprovalStatus.approved,
        role: UserRole.admin,
      },
    });
  }

  return prisma.userAccess.create({
    data: {
      clerkUserId: ATLAS_CLERK_USER_ID,
      email: ATLAS_EMAIL,
      fullName: "Atlas",
      role: UserRole.admin,
      approvalStatus: ApprovalStatus.approved,
    },
  });
}
