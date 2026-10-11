import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AssetSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function storageConfig() {
  const bucket = process.env.MEDIA_S3_BUCKET?.trim();
  const region = process.env.MEDIA_S3_REGION?.trim() || "auto";
  const accessKeyId = process.env.MEDIA_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.MEDIA_S3_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = process.env.MEDIA_ASSET_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) return null;
  return { bucket, region, accessKeyId, secretAccessKey, endpoint: process.env.MEDIA_S3_ENDPOINT?.trim(), publicBaseUrl };
}

export function isGeneratedAssetStorageConfigured() {
  return Boolean(storageConfig());
}

export async function ingestGeneratedMedia(input: {
  jobId: string;
  outputUrl: string;
  title: string;
  targetType: string;
  targetId: string;
}) {
  const config = storageConfig();
  if (!config) throw new Error("Generated media storage is not configured.");

  const response = await fetch(input.outputUrl);
  if (!response.ok) throw new Error(`Could not download generated media (${response.status}).`);
  const contentType = response.headers.get("content-type")?.split(";")[0] || "video/mp4";
  const bytes = Buffer.from(await response.arrayBuffer());
  const key = `generated/video/${input.jobId}.mp4`;
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: Boolean(config.endpoint),
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: bytes, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));

  const fileUrl = `${config.publicBaseUrl}/${key}`;
  return prisma.asset.upsert({
    where: { source_externalId: { source: AssetSource.manual, externalId: `media-generation:${input.jobId}` } },
    create: {
      source: AssetSource.manual,
      externalId: `media-generation:${input.jobId}`,
      title: input.title,
      fileUrl,
      thumbnailUrl: fileUrl,
      mimeType: contentType,
      mediaType: "video",
      fileSize: bytes.length,
      metadata: { generatedBy: "runway", generationJobId: input.jobId, targetType: input.targetType, targetId: input.targetId } as Prisma.InputJsonValue,
      syncedAt: new Date(),
    },
    update: { title: input.title, fileUrl, thumbnailUrl: fileUrl, mimeType: contentType, mediaType: "video", fileSize: bytes.length, syncedAt: new Date() },
  });
}
