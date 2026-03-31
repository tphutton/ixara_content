"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createActionLog } from "@/lib/actions/action-log";
import { deleteCampaign, upsertCampaign } from "@/lib/campaigns/client";
import { type CampaignStatus } from "@/lib/campaigns/types";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { parseOptionalString, parseStringArray } from "@/lib/forms/parsers";
import { prisma } from "@/lib/prisma";

function getCampaignInput(formData: FormData) {
  return {
    campaign_name: String(formData.get("campaign_name") ?? "").trim(),
    campaign_status:
      (parseOptionalString(formData.get("campaign_status")) as CampaignStatus | null) ?? "draft",
    campaign_type: parseOptionalString(formData.get("campaign_type")),
    brand: parseStringArray(formData.get("brand")),
    start_date: parseOptionalString(formData.get("start_date")),
    end_date: parseOptionalString(formData.get("end_date")),
    campaign_description: parseOptionalString(formData.get("campaign_description")),
    featured_image_link: parseOptionalString(formData.get("featured_image_link")),
    country: parseOptionalString(formData.get("country")),
    region: parseOptionalString(formData.get("region")),
    category: parseOptionalString(formData.get("category")),
    partner_id: parseOptionalString(formData.get("partner_id")),
  };
}

export async function createCampaignAction(formData: FormData) {
  const access = await requireApprovedUserAccess();
  const data = getCampaignInput(formData);
  const linkedAssetId = parseOptionalString(formData.get("linkedAssetId"));

  if (!data.campaign_name) {
    throw new Error("Campaign name is required.");
  }

  const campaign = await upsertCampaign(data);

  if (linkedAssetId) {
    await prisma.campaignAsset.create({
      data: {
        campaignId: campaign.campaign_id,
        assetId: linkedAssetId,
        role: "primary",
      },
    });
  }

  await createActionLog({
    userId: access.id,
    actionType: "create",
    targetType: "campaign",
    targetId: campaign.campaign_id,
    summary: `Created campaign "${campaign.campaign_name}"`,
    afterData: campaign,
    source: "manual",
  });

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.campaign_id}`);
}

export async function updateCampaignAction(campaignId: string, formData: FormData) {
  const access = await requireApprovedUserAccess();
  const data = getCampaignInput(formData);
  const linkedAssetId = parseOptionalString(formData.get("linkedAssetId"));

  if (!data.campaign_name) {
    throw new Error("Campaign name is required.");
  }

  const campaign = await upsertCampaign({
    ...data,
    campaign_id: campaignId,
  });

  await prisma.campaignAsset.deleteMany({
    where: { campaignId },
  });

  if (linkedAssetId) {
    await prisma.campaignAsset.create({
      data: {
        campaignId,
        assetId: linkedAssetId,
        role: "primary",
      },
    });
  }

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "campaign",
    targetId: campaign.campaign_id,
    summary: `Updated campaign "${campaign.campaign_name}"`,
    afterData: campaign,
    source: "manual",
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function deleteCampaignAction(campaignId: string, campaignName: string) {
  const access = await requireApprovedUserAccess();

  await deleteCampaign(campaignId);
  await prisma.campaignAsset.deleteMany({ where: { campaignId } });

  await createActionLog({
    userId: access.id,
    actionType: "delete",
    targetType: "campaign",
    targetId: campaignId,
    summary: `Deleted campaign "${campaignName}"`,
    source: "manual",
  });

  revalidatePath("/campaigns");
  redirect("/campaigns");
}
