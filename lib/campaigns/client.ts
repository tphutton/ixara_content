import {
  type Campaign,
  type CampaignListResponse,
  type CampaignStatus,
  type CampaignUpsertInput,
} from "@/lib/campaigns/types";

export class CampaignsApiError extends Error {
  code: "missing_api_key" | "request_failed";

  constructor(message: string, code: "missing_api_key" | "request_failed") {
    super(message);
    this.name = "CampaignsApiError";
    this.code = code;
  }
}

const campaignsApiBaseUrl =
  process.env.CAMPAIGNS_API_BASE_URL?.replace(/\/$/, "") ?? "https://data.techsport.asia/api";

function getCampaignsApiKey() {
  const apiKey = process.env.CAMPAIGNS_API_KEY;

  if (!apiKey) {
    throw new CampaignsApiError("CAMPAIGNS_API_KEY is not set.", "missing_api_key");
  }

  return apiKey;
}

async function campaignsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${campaignsApiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getCampaignsApiKey(),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new CampaignsApiError(
      `Campaign API request failed (${response.status}): ${errorBody || response.statusText}`,
      "request_failed",
    );
  }

  return response.json() as Promise<T>;
}

export async function listCampaigns(filters?: {
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();

  if (filters?.status) params.set("status", filters.status);
  if (filters?.startDate) params.set("start_date", filters.startDate);
  if (filters?.endDate) params.set("end_date", filters.endDate);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));

  return campaignsRequest<CampaignListResponse>(`/campaigns${params.size ? `?${params.toString()}` : ""}`);
}

export async function listAllCampaigns() {
  const response = await campaignsRequest<{ success: boolean; count: number; data: Campaign[] }>(
    "/campaigns/all",
  );

  return response.data;
}

export async function getCampaign(campaignId: string) {
  const response = await campaignsRequest<{ success: boolean; data: Campaign }>(
    `/campaigns/${campaignId}`,
  );

  return response.data;
}

export async function listCampaignsByBrand(brand: string) {
  const params = new URLSearchParams({ brand });
  const response = await campaignsRequest<{
    success: boolean;
    count: number;
    brand: string;
    data: Campaign[];
  }>(`/campaigns/by_brand?${params.toString()}`);

  return response.data;
}

export async function upsertCampaign(input: CampaignUpsertInput) {
  const response = await campaignsRequest<{ success: boolean; data: Campaign }>("/campaigns/upsert", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function deleteCampaign(campaignId: string) {
  return campaignsRequest<{ success: boolean; message: string }>(`/campaigns/${campaignId}`, {
    method: "DELETE",
  });
}

export async function safeListCampaigns(filters?: {
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const response = await listCampaigns(filters);
    return {
      ok: true as const,
      data: response.data,
      pagination: response.pagination,
      error: null,
    };
  } catch (error) {
    return {
      ok: false as const,
      data: [] as Campaign[],
      pagination: null,
      error: error instanceof Error ? error.message : "Campaign API request failed.",
    };
  }
}
