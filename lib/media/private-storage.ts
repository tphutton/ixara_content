import { S3Client } from "@aws-sdk/client-s3";

export function privateStorageConfig() {
  const bucket = process.env.MEDIA_S3_BUCKET?.trim();
  const endpoint = process.env.MEDIA_S3_ENDPOINT?.trim();
  const accessKeyId = process.env.MEDIA_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.MEDIA_S3_SECRET_ACCESS_KEY?.trim();
  const region = process.env.MEDIA_S3_REGION?.trim() || "auto";
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;
  return { bucket, endpoint, region, accessKeyId, secretAccessKey };
}

export function privateStorageClient() {
  const config = privateStorageConfig();
  if (!config) throw new Error("Private media storage is not configured.");
  return { bucket: config.bucket, client: new S3Client({ endpoint: config.endpoint, region: config.region, forcePathStyle: process.env.MEDIA_S3_FORCE_PATH_STYLE === "true", credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }) };
}

export function privateAssetUrl(id: string) { return `/api/assets/${encodeURIComponent(id)}/file`; }
export function privateObjectKey(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  return m.storage === "private-s3" && typeof m.objectKey === "string" && /^(uploads|generated)\/[a-zA-Z0-9/_-]+\.[a-z0-9]+$/.test(m.objectKey) ? m.objectKey : null;
}
