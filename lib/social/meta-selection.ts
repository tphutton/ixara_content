import { randomUUID } from "crypto";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";
import type { MetaPageAccount } from "./meta";

type PendingMetaSelection = {
  id: string; accountId: string; ownerId: string; expiresAt: number;
  tokenExpiresAt: string | null; pages: MetaPageAccount[];
};
export function eligibleMetaPages(platform: string, pages: MetaPageAccount[]) {
  return pages.filter(page => Boolean(page.id && page.access_token) &&
    (platform === "facebook" || (platform === "instagram" && Boolean(page.instagram_business_account?.id))));
}
export function normalizeInstagramHandle(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (!["instagram.com", "www.instagram.com"].includes(url.hostname)) return trimmed;
    const username = url.pathname.split("/").filter(Boolean)[0];
    return username ? "@" + username : null;
  } catch { return trimmed ? "@" + trimmed.replace(/^@/, "") : null; }
}
export function createMetaSelection(input: Omit<PendingMetaSelection, "id" | "expiresAt">) {
  const selection = { ...input, id: randomUUID(), expiresAt: Date.now() + 10 * 60 * 1000 };
  return encryptSecret(JSON.stringify(selection));
}
export function readMetaSelection(encrypted: unknown, accountId: string, ownerId: string): PendingMetaSelection {
  if (typeof encrypted !== "string") throw new Error("Start Connect Meta again to choose an account.");
  const saved = JSON.parse(decryptSecret(encrypted)) as PendingMetaSelection;
  if (saved.accountId !== accountId || saved.ownerId !== ownerId || !saved.id ||
      !Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now() || !Array.isArray(saved.pages)) {
    throw new Error("Account selection expired or belongs to another session. Start Connect Meta again.");
  }
  return saved;
}
export function selectAuthorizedMetaPage(saved: PendingMetaSelection, selectionId: string, pageId: string, platform: string) {
  if (saved.id !== selectionId) throw new Error("Account selection changed. Start Connect Meta again.");
  const page = eligibleMetaPages(platform, saved.pages).find(item => item.id === pageId);
  if (!page) throw new Error("Choose one of the authorized accounts shown in the list.");
  return page;
}
