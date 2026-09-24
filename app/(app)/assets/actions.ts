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
  const limitValue = Number.parseInt(String(formData.get("limit") ?? "5000"), 10);
  const limit = Number.isFinite(limitValue) ? limitValue : 5000;
  const result = await syncTsadbImages({ ownerId, salesItemId, limit });

  await createActionLog({
    userId: access.id,
    actionType: "sync",
    targetType: "asset",
    targetId: ownerId ?? salesItemId ?? "tsadb",
    summary: `Synced ${result.count} enriched TSADB image asset${result.count === 1 ? "" : "s"}`,
    afterData: {
      count: result.count,
      sourceRecordCount: result.sourceRecordCount,
      newAssets: result.newAssets,
      skipped: result.skipped,
      ownerId,
      salesItemId,
      limit,
    },
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

export async function bulkUpdateAssetsAction(formData: FormData) {
  const access = await requireApprovedUserAccess();
  const assetIds = [...new Set(
    formData.getAll("assetIds")
      .map((value) => typeof value === "string" ? value.trim() : "")
      .filter((value): value is string => Boolean(value)),
  )];
  const action = parseOptionalString(formData.get("action"));

  if (assetIds.length === 0) throw new Error("Select at least one asset.");
  if (!action || !["delete", "feature", "unfeature"].includes(action)) {
    throw new Error("Choose a valid bulk asset action.");
  }

  const before = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true, title: true, featured: true },
  });

  if (action === "delete") {
    await prisma.asset.deleteMany({ where: { id: { in: before.map((asset) => asset.id) } } });
    await Promise.all(
      before.map((asset) => createActionLog({
        userId: access.id,
        actionType: "delete",
        targetType: "asset",
        targetId: asset.id,
        summary: `Deleted asset: ${asset.title}`,
        beforeData: asset,
        source: "manual",
      })),
    );
  } else {
    await prisma.asset.updateMany({
      where: { id: { in: before.map((asset) => asset.id) } },
      data: { featured: action === "feature" },
    });
    await createActionLog({
      userId: access.id,
      actionType: "update",
      targetType: "asset",
      targetId: "bulk",
      summary: `${action === "feature" ? "Featured" : "Unfeatured"} ${before.length} asset${before.length === 1 ? "" : "s"}`,
      beforeData: before,
      afterData: { assetIds: before.map((asset) => asset.id), featured: action === "feature" },
      source: "manual",
    });
  }

  revalidatePath("/assets");
}

function parseOptionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
