"use server";

import { revalidatePath } from "next/cache";
import { createActionLog } from "@/lib/actions/action-log";
import { syncTsadbImages } from "@/lib/assets/tsadb-images";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { prisma } from "@/lib/prisma";
import { syncLatestWordPressMedia } from "@/lib/wordpress/media";

export async function syncWordPressAssetsAction() {
  const access = await requireApprovedUserAccess();
  const assets = await syncLatestWordPressMedia(50);

  await createActionLog({
    userId: access.id,
    actionType: "sync",
    targetType: "asset",
    targetId: "wordpress",
    summary: `Synced ${assets.length} WordPress asset${assets.length === 1 ? "" : "s"}`,
    afterData: { count: assets.length },
    source: "manual",
  });

  revalidatePath("/assets");
}

export async function syncTsadbAssetsAction(formData: FormData) {
  const access = await requireApprovedUserAccess();
  const ownerId = parseOptionalString(formData.get("ownerId"));
  const salesItemId = parseOptionalString(formData.get("salesItemId"));
  const limitValue = Number.parseInt(String(formData.get("limit") ?? "1000"), 10);
  const limit = Number.isFinite(limitValue) ? limitValue : 1000;
  const result = await syncTsadbImages({ ownerId, salesItemId, limit });

  await createActionLog({
    userId: access.id,
    actionType: "sync",
    targetType: "asset",
    targetId: ownerId ?? salesItemId ?? "tsadb",
    summary: `Synced ${result.count} enriched TSADB image asset${result.count === 1 ? "" : "s"}`,
    afterData: { count: result.count, skipped: result.skipped, ownerId, salesItemId, limit },
    source: "manual",
  });

  revalidatePath("/assets");
}

export async function deleteAssetAction(formData: FormData) {
  const access = await requireApprovedUserAccess();
  const id = parseOptionalString(formData.get("id"));
  if (!id) throw new Error("Asset id is required.");

  const before = await prisma.asset.findUniqueOrThrow({ where: { id } });
  await prisma.asset.delete({ where: { id } });

  await createActionLog({
    userId: access.id,
    actionType: "delete",
    targetType: "asset",
    targetId: id,
    summary: `Deleted asset: ${before.title}`,
    beforeData: before,
    source: "manual",
  });

  revalidatePath("/assets");
}

function parseOptionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
