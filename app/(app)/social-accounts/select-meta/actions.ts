"use server";
import { Prisma, ConnectedAccountStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEditorialUserAccess } from "@/lib/auth/user-access";
import { encryptSecret } from "@/lib/security/encryption";
import { readMetaSelection, selectAuthorizedMetaPage, normalizeInstagramHandle } from "@/lib/social/meta-selection";
import { createActionLog } from "@/lib/actions/action-log";

export async function confirmMetaSelection(accountId: string, selectionId: string, form: FormData) {
  const access = await requireEditorialUserAccess();
  let failure: string | null = null;
  try {
    await prisma.$transaction(async tx => {
      const account = await tx.connectedAccount.findUniqueOrThrow({ where: { id: accountId } });
      const metadata = account.metadata && typeof account.metadata === "object" && !Array.isArray(account.metadata)
        ? account.metadata as Record<string, Prisma.JsonValue> : {};
      const saved = readMetaSelection(metadata.pendingMetaConnection, account.id, access.id);
      const page = selectAuthorizedMetaPage(saved, selectionId, String(form.get("pageId") ?? ""), account.platform);
      const instagram = account.platform === "instagram";
      const { pendingMetaConnection: _pending, ...previousMetadata } = metadata;
      const changed = await tx.connectedAccount.updateMany({
        where: { id: account.id, updatedAt: account.updatedAt },
        data: {
          externalAccountId: instagram ? page.instagram_business_account!.id : page.id,
          accountHandle: instagram ? normalizeInstagramHandle(page.instagram_business_account?.username) : account.accountHandle,
          encryptedAccessToken: encryptSecret(page.access_token!),
          tokenExpiresAt: saved.tokenExpiresAt ? new Date(saved.tokenExpiresAt) : null,
          status: ConnectedAccountStatus.active, lastSyncedAt: null,
          scopes: (process.env.META_SCOPES || "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_manage_insights,instagram_content_publish").split(",").map(x => x.trim()).filter(Boolean),
          lastSyncStatus: "Meta connected to " + page.name + (instagram ? " / @" + page.instagram_business_account?.username : ""),
          metadata: { ...previousMetadata, metaPageId: page.id, metaPageName: page.name,
            instagramBusinessAccountId: page.instagram_business_account?.id ?? null,
            instagramUsername: page.instagram_business_account?.username ?? null,
            metaConfirmedById: access.id, metaConfirmedAt: new Date().toISOString() },
          updatedById: access.id,
        },
      });
      if (changed.count !== 1) throw new Error("Connection changed while selecting. Reopen Connect Meta.");
      await createActionLog({
        userId: access.id, actionType: "update", targetType: "connected_account", targetId: account.id,
        summary: "Confirmed Meta identity: " + page.name,
        afterData: { metaPageId: page.id, instagramBusinessAccountId: page.instagram_business_account?.id ?? null },
        source: "manual",
      });
    });
  } catch (error) { failure = error instanceof Error ? error.message : "Account selection failed."; }
  revalidatePath("/social-accounts");
  redirect(failure ? "/social-accounts?error=" + encodeURIComponent(failure) : "/social-accounts?success=meta_connected");
}
