"use server";

import {
  ConnectedAccountStatus,
  SocialPlatform,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createActionLog } from "@/lib/actions/action-log";
import { requireEditorialUserAccess } from "@/lib/auth/user-access";
import { parseOptionalString, parseStringArray } from "@/lib/forms/parsers";
import { prisma } from "@/lib/prisma";
import { syncConnectedMetaAccount } from "@/lib/social/meta-sync";

function parseEnum<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function getConnectedAccountInput(formData: FormData) {
  return {
    platform: parseEnum(
      formData.get("platform"),
      Object.values(SocialPlatform),
      SocialPlatform.facebook,
    ),
    status: parseEnum(
      formData.get("status"),
      Object.values(ConnectedAccountStatus),
      ConnectedAccountStatus.pending_setup,
    ),
    accountName: String(formData.get("accountName") ?? "").trim(),
    accountHandle: parseOptionalString(formData.get("accountHandle")),
    externalAccountId: parseOptionalString(formData.get("externalAccountId")),
    brandProfileId: parseOptionalString(formData.get("brandProfileId")),
    brandName: parseOptionalString(formData.get("brandName")),
    scopes: parseStringArray(formData.get("scopes")),
    region: parseOptionalString(formData.get("region")),
    country: parseOptionalString(formData.get("country")),
    lastSyncStatus: parseOptionalString(formData.get("lastSyncStatus")),
  };
}

export async function createConnectedAccountAction(formData: FormData) {
  const access = await requireEditorialUserAccess();
  const data = getConnectedAccountInput(formData);

  if (!data.accountName) {
    throw new Error("Account name is required.");
  }

  const account = await prisma.connectedAccount.create({
    data: {
      ...data,
      createdById: access.id,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "create",
    targetType: "connected_account",
    targetId: account.id,
    summary: `Created ${account.platform} account "${account.accountName}"`,
    afterData: account,
    source: "manual",
  });

  revalidatePath("/social-accounts");
  revalidatePath("/analytics");
}

export async function updateConnectedAccountAction(id: string, formData: FormData) {
  const access = await requireEditorialUserAccess();
  const before = await prisma.connectedAccount.findUniqueOrThrow({ where: { id } });
  const data = getConnectedAccountInput(formData);

  if (!data.accountName) {
    throw new Error("Account name is required.");
  }

  const account = await prisma.connectedAccount.update({
    where: { id },
    data: {
      ...data,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "connected_account",
    targetId: account.id,
    summary: `Updated ${account.platform} account "${account.accountName}"`,
    beforeData: before,
    afterData: account,
    source: "manual",
  });

  revalidatePath("/social-accounts");
  revalidatePath("/analytics");
}

export async function disconnectConnectedAccountAction(id: string) {
  const access = await requireEditorialUserAccess();
  const before = await prisma.connectedAccount.findUniqueOrThrow({ where: { id } });

  const account = await prisma.connectedAccount.update({
    where: { id },
    data: {
      status: ConnectedAccountStatus.disconnected,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "connected_account",
    targetId: account.id,
    summary: `Marked ${account.platform} account "${account.accountName}" as disconnected`,
    beforeData: before,
    afterData: account,
    source: "manual",
  });

  revalidatePath("/social-accounts");
  revalidatePath("/analytics");
}

export async function deleteConnectedAccountAction(id: string) {
  const access = await requireEditorialUserAccess();
  const before = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id },
    include: { publishedPosts: { select: { id: true } } },
  });

  await prisma.connectedAccount.delete({ where: { id } });

  await createActionLog({
    userId: access.id,
    actionType: "delete",
    targetType: "connected_account",
    targetId: id,
    summary: `Deleted ${before.platform} account "${before.accountName}"`,
    beforeData: {
      id: before.id,
      platform: before.platform,
      accountName: before.accountName,
      linkedPublishedPosts: before.publishedPosts.length,
    },
    source: "manual",
  });

  revalidatePath("/social-accounts");
  revalidatePath("/analytics");
}

export async function syncConnectedAccountNowAction(id: string) {
  const access = await requireEditorialUserAccess();

  await syncConnectedMetaAccount({
    accountId: id,
    userId: access.id,
  });

  revalidatePath("/social-accounts");
  revalidatePath("/analytics");
  revalidatePath("/dashboard");
}
