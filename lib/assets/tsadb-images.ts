import { AssetSource, type Asset } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class TsadbImagesError extends Error {
  code: "missing_config" | "request_failed";

  constructor(message: string, code: "missing_config" | "request_failed") {
    super(message);
    this.name = "TsadbImagesError";
    this.code = code;
  }
}

type TsadbImage = {
  id?: number | string | null;
  image_id?: string | null;
  image_link?: string | null;
  caption?: string | null;
  featured?: boolean | string | null;
  image_description?: string | null;
  item_name?: string | null;
  item_id?: string | null;
  sales_item_id?: string | null;
  sales_item_id_uuid?: string | null;
  country?: string | null;
  region?: string | null;
  item_type?: string | null;
  category?: string | null;
  owner_id?: string | null;
  wordpress_attachment_id?: number | string | null;
  image_type?: string | null;
  facility_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SyncTsadbImagesOptions = {
  ownerId?: string | null;
  salesItemId?: string | null;
  limit?: number;
};

const tsadbApiBaseUrl =
  process.env.TSADB_API_BASE_URL?.replace(/\/$/, "") ??
  process.env.CAMPAIGNS_API_BASE_URL?.replace(/\/$/, "") ??
  "https://data.techsport.asia/api";

function getTsadbApiKey() {
  const apiKey = process.env.TSADB_API_KEY ?? process.env.CAMPAIGNS_API_KEY;

  if (!apiKey) {
    throw new TsadbImagesError("TSADB_API_KEY or CAMPAIGNS_API_KEY is not set.", "missing_config");
  }

  return apiKey;
}

async function tsadbRequest<T>(path: string) {
  const response = await fetch(`${tsadbApiBaseUrl}${path}`, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getTsadbApiKey(),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new TsadbImagesError(
      `TSADB images request failed (${response.status}): ${body || response.statusText}`,
      "request_failed",
    );
  }

  return response.json() as Promise<T>;
}

function pickImagesFromResponse(response: unknown): TsadbImage[] {
  if (Array.isArray(response)) return response as TsadbImage[];

  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    if (Array.isArray(record.images)) return record.images as TsadbImage[];
    if (Array.isArray(record.data)) return record.data as TsadbImage[];
    if (record.data && typeof record.data === "object") {
      const nested = record.data as Record<string, unknown>;
      if (Array.isArray(nested.images)) return nested.images as TsadbImage[];
      if (Array.isArray(nested.data)) return nested.data as TsadbImage[];
    }
  }

  return [];
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  if (value === true || value === "true") return true;
  return false;
}

function asInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function orientationFromUrl(row: TsadbImage) {
  const metadata = row as Record<string, unknown>;
  const width = asInteger(metadata.width);
  const height = asInteger(metadata.height);

  if (!width || !height) return null;
  if (Math.abs(width - height) / Math.max(width, height) < 0.08) return "square";
  return width > height ? "landscape" : "portrait";
}

function buildTags(row: TsadbImage) {
  return [
    row.category,
    row.item_type,
    row.image_type,
    row.region,
    row.country,
    row.item_name,
    row.featured ? "featured" : null,
  ]
    .map(asString)
    .filter((tag, index, tags): tag is string => Boolean(tag) && tags.indexOf(tag) === index);
}

function titleFor(row: TsadbImage) {
  return (
    asString(row.caption) ??
    asString(row.item_name) ??
    asString(row.category) ??
    asString(row.image_type) ??
    `TSADB image ${row.image_id ?? row.id ?? ""}`.trim()
  );
}

function mapTsadbImageToAsset(row: TsadbImage) {
  const fileUrl = asString(row.image_link);
  const externalId = asString(row.image_id) ?? asString(row.id) ?? fileUrl;

  if (!fileUrl || !externalId) return null;

  return {
    source: AssetSource.tsadb,
    externalId,
    title: titleFor(row),
    fileUrl,
    thumbnailUrl: fileUrl,
    mediaType: "image",
    altText: asString(row.caption) ?? asString(row.image_description),
    caption: asString(row.caption),
    description: asString(row.image_description),
    category: asString(row.category),
    itemName: asString(row.item_name),
    itemId: asString(row.sales_item_id_uuid) ?? asString(row.sales_item_id) ?? asString(row.item_id),
    itemType: asString(row.item_type),
    imageType: asString(row.image_type),
    wordpressAttachmentId: asInteger(row.wordpress_attachment_id),
    featured: asBoolean(row.featured),
    orientation: orientationFromUrl(row),
    region: asString(row.region),
    country: asString(row.country),
    tags: buildTags(row),
    sourceCreatedAt: asDate(row.created_at),
    sourceUpdatedAt: asDate(row.updated_at),
    lastEnrichedAt: new Date(),
    syncedAt: new Date(),
    metadata: row as object,
  };
}

async function fetchTsadbImages(options: SyncTsadbImagesOptions = {}) {
  const ownerId = asString(options.ownerId) ?? asString(process.env.TSADB_IMAGES_OWNER_ID);
  const salesItemId = asString(options.salesItemId) ?? asString(process.env.TSADB_IMAGES_SALES_ITEM_ID);
  const limit = Math.min(Math.max(options.limit ?? 1000, 1), 1000);

  if (ownerId) {
    const response = await tsadbRequest<unknown>(`/ixara_connect/images/organization/${encodeURIComponent(ownerId)}`);
    return pickImagesFromResponse(response).slice(0, limit);
  }

  if (salesItemId) {
    const response = await tsadbRequest<unknown>(`/ixara_connect/images/sales_item/${encodeURIComponent(salesItemId)}`);
    return pickImagesFromResponse(response).slice(0, limit);
  }

  const response = await tsadbRequest<unknown>(`/tables/images?limit=${limit}`);
  return pickImagesFromResponse(response).slice(0, limit);
}

async function upsertTsadbAsset(row: TsadbImage) {
  const data = mapTsadbImageToAsset(row);
  if (!data) return null;

  const existing = await prisma.asset.findFirst({
    where: {
      OR: [
        { source: AssetSource.tsadb, externalId: data.externalId },
        { fileUrl: data.fileUrl },
        data.wordpressAttachmentId ? { wordpressAttachmentId: data.wordpressAttachmentId } : undefined,
      ].filter(Boolean) as Array<Record<string, unknown>>,
    },
  });

  if (existing) {
    return prisma.asset.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.asset.create({ data });
}

export async function syncTsadbImages(options: SyncTsadbImagesOptions = {}) {
  const images = await fetchTsadbImages(options);
  const synced: Asset[] = [];
  let skipped = 0;

  for (const row of images) {
    const asset = await upsertTsadbAsset(row);
    if (asset) {
      synced.push(asset);
    } else {
      skipped += 1;
    }
  }

  return {
    count: synced.length,
    skipped,
    assets: synced,
  };
}
