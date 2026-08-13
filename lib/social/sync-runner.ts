import {
  ConnectedAccountStatus,
  SocialPlatform,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncConnectedMetaAccount } from "@/lib/social/meta-sync";

type RunDueSocialSyncInput = {
  limit?: number;
  staleAfterHours?: number;
  userId?: string;
  source?: "manual" | "scheduled" | "ai";
};

export async function runDueSocialSync(input: RunDueSocialSyncInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);
  const staleAfterHours = Math.min(Math.max(input.staleAfterHours ?? 6, 1), 168);
  const staleBefore = new Date(Date.now() - staleAfterHours * 60 * 60 * 1000);

  const accounts = await prisma.connectedAccount.findMany({
    where: {
      platform: { in: [SocialPlatform.facebook, SocialPlatform.instagram] },
      status: ConnectedAccountStatus.active,
      encryptedAccessToken: { not: null },
      OR: [
        { lastSyncedAt: null },
        { lastSyncedAt: { lt: staleBefore } },
      ],
    },
    orderBy: [
      { lastSyncedAt: "asc" },
      { updatedAt: "asc" },
    ],
    take: limit,
  });

  const results = [];

  for (const account of accounts) {
    try {
      const result = await syncConnectedMetaAccount({
        accountId: account.id,
        userId: input.userId,
        source: input.source ?? "scheduled",
      });

      results.push({
        accountId: account.id,
        accountName: account.accountName,
        platform: account.platform,
        ok: true,
        syncedCount: result.syncedCount,
      });
    } catch (error) {
      results.push({
        accountId: account.id,
        accountName: account.accountName,
        platform: account.platform,
        ok: false,
        error: error instanceof Error ? error.message : "Social sync failed.",
      });
    }
  }

  return {
    checked: accounts.length,
    succeeded: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    staleAfterHours,
    results,
  };
}
