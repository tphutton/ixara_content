export const campaignStatuses = [
  "draft",
  "active",
  "completed",
  "cancelled",
] as const;

export const campaignTypes = [
  "Flash Sale",
  "Price Promotion",
  "Feature Promotion",
  "Feature Launch",
  "Product Update",
  "Content Promotion",
  "Event Promotion",
  "Giveaway",
  "Region Focus",
  "Category Focus",
  "Partner Promotion",
] as const;

export type CampaignStatus = (typeof campaignStatuses)[number];
export type CampaignType = (typeof campaignTypes)[number];

export type Campaign = {
  campaign_id: string;
  brand: string[];
  start_date: string | null;
  end_date: string | null;
  campaign_name: string;
  campaign_description: string | null;
  featured_image_link: string | null;
  campaign_status: CampaignStatus;
  campaign_type: string | null;
  country: string | null;
  region: string | null;
  category: string | null;
  partner_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignListResponse = {
  success: boolean;
  data: Campaign[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

export type CampaignUpsertInput = {
  campaign_id?: string;
  campaign_name: string;
  brand?: string[];
  start_date?: string | null;
  end_date?: string | null;
  campaign_description?: string | null;
  featured_image_link?: string | null;
  campaign_status?: CampaignStatus;
  campaign_type?: string | null;
  country?: string | null;
  region?: string | null;
  category?: string | null;
  partner_id?: string | null;
};
