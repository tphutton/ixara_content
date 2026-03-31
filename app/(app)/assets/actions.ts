"use server";

import { revalidatePath } from "next/cache";
import { createActionLog } from "@/lib/actions/action-log";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
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
