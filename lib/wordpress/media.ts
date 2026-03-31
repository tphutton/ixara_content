import { prisma } from "@/lib/prisma";
import { AssetSource } from "@prisma/client";

type WordPressMediaItem = {
  id: number;
  date_gmt: string;
  modified_gmt: string;
  slug: string;
  title: { rendered: string };
  caption: { rendered: string };
  alt_text: string;
  media_type: string;
  mime_type: string;
  source_url: string;
  media_details?: {
    width?: number;
    height?: number;
    filesize?: number;
    sizes?: {
      thumbnail?: { source_url?: string };
      medium?: { source_url?: string };
    };
  };
};

const wordpressMediaBaseUrl =
  process.env.WORDPRESS_MEDIA_BASE_URL?.replace(/\/$/, "") ??
  "https://media.ixara.tech/wp-json/wp/v2";

async function wordpressRequest<T>(path: string) {
  const response = await fetch(`${wordpressMediaBaseUrl}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`WordPress media request failed (${response.status}): ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}

function mapWordPressMediaToAsset(media: WordPressMediaItem) {
  return {
    source: AssetSource.wordpress,
    externalId: String(media.id),
    title: stripHtml(media.title.rendered) || media.slug || `Media ${media.id}`,
    slug: media.slug,
    fileUrl: media.source_url,
    thumbnailUrl:
      media.media_details?.sizes?.thumbnail?.source_url ??
      media.media_details?.sizes?.medium?.source_url ??
      media.source_url,
    mimeType: media.mime_type,
    mediaType: media.media_type,
    width: media.media_details?.width ?? null,
    height: media.media_details?.height ?? null,
    fileSize: media.media_details?.filesize ?? null,
    altText: media.alt_text || null,
    caption: stripHtml(media.caption.rendered) || null,
    sourceCreatedAt: media.date_gmt ? new Date(media.date_gmt) : null,
    sourceUpdatedAt: media.modified_gmt ? new Date(media.modified_gmt) : null,
    metadata: media as unknown as object,
    syncedAt: new Date(),
  };
}

export async function fetchLatestWordPressMedia(limit = 50) {
  return wordpressRequest<WordPressMediaItem[]>(
    `/media?per_page=${Math.min(Math.max(limit, 1), 100)}`,
  );
}

export async function syncLatestWordPressMedia(limit = 50) {
  const mediaItems = await fetchLatestWordPressMedia(limit);

  const syncedAssets = await Promise.all(
    mediaItems.map((media) =>
      prisma.asset.upsert({
        where: {
          source_externalId: {
            source: AssetSource.wordpress,
            externalId: String(media.id),
          },
        },
        create: mapWordPressMediaToAsset(media),
        update: mapWordPressMediaToAsset(media),
      }),
    ),
  );

  return syncedAssets;
}
