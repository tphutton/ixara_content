import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ApprovalStatus, UserRole, type UserAccess } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

function getPrimaryEmail(user: ClerkUser) {
  return user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

function getFullName(user: ClerkUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || null;
}

async function getBootstrapAccess(email: string) {
  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();

  if (initialAdminEmail && initialAdminEmail === email.toLowerCase()) {
    return {
      approvalStatus: ApprovalStatus.approved,
      role: UserRole.admin,
    };
  }

  return {
    approvalStatus: ApprovalStatus.pending,
    role: UserRole.viewer,
  };
}

export async function syncUserAccessRecord(user: ClerkUser) {
  const email = getPrimaryEmail(user);

  if (!email) {
    throw new Error("Authenticated Clerk user is missing an email address.");
  }

  const fullName = getFullName(user);
  const existing = await prisma.userAccess.findUnique({
    where: { clerkUserId: user.id },
  });

  if (existing) {
    return prisma.userAccess.update({
      where: { id: existing.id },
      data: {
        email,
        fullName,
      },
    });
  }

  const bootstrapAccess = await getBootstrapAccess(email);

  return prisma.userAccess.create({
    data: {
      clerkUserId: user.id,
      email,
      fullName,
      role: bootstrapAccess.role,
      approvalStatus: bootstrapAccess.approvalStatus,
    },
  });
}

export const getCurrentUserAccess = cache(async () => {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await currentUser();

  if (!user) {
    return null;
  }

  return syncUserAccessRecord(user);
});

export async function requireApprovedUserAccess() {
  const access = await getCurrentUserAccess();

  if (!access) {
    redirect("/sign-in");
  }

  if (access.approvalStatus !== ApprovalStatus.approved) {
    redirect("/pending-approval");
  }

  return access;
}

export async function requireAdminUserAccess() {
  const access = await requireApprovedUserAccess();

  if (access.role !== UserRole.admin) {
    redirect("/dashboard");
  }

  return access;
}

export async function requireEditorialUserAccess() {
  const access = await requireApprovedUserAccess();

  if (access.role === UserRole.viewer) {
    redirect("/dashboard");
  }

  return access;
}

export function isUserRole(value: FormDataEntryValue | null): value is UserRole {
  return value === UserRole.admin || value === UserRole.editor || value === UserRole.viewer;
}

export function isApprovalStatus(value: FormDataEntryValue | null): value is ApprovalStatus {
  return (
    value === ApprovalStatus.pending ||
    value === ApprovalStatus.approved ||
    value === ApprovalStatus.rejected
  );
}

export type CurrentUserAccess = UserAccess;
