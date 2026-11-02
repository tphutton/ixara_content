import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { AssetSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { privateAssetUrl, privateStorageClient, privateStorageConfig } from "@/lib/media/private-storage";

export function isGeneratedAssetStorageConfigured() { return Boolean(privateStorageConfig()); }

export async function ingestGeneratedMedia(input: { jobId: string; outputUrl: string; title: string; targetType: string; targetId: string }) {
  const config = privateStorageConfig();
  if (!config) throw new Error("Generated media storage is not configured.");
  const response = await fetch(input.outputUrl);
  if (!response.ok || !response.body) throw new Error(`Could not download generated media (${response.status}).`);
  const limit = 100 * 1024 * 1024;
  const declaredSize = Number(response.headers.get("content-length"));
  if (declaredSize > limit) throw new Error("Generated media exceeds the 100 MB ingestion limit.");
  const chunks: Uint8Array[] = []; let total = 0;
  for await (const part of response.body as unknown as AsyncIterable<Uint8Array>) {
    total += part.byteLength;
    if (total > limit) throw new Error("Generated media exceeds the 100 MB ingestion limit.");
    chunks.push(part);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0] || "video/mp4";
  if (!contentType.startsWith("video/")) throw new Error("Generated media is not a video.");
  const bytes = Buffer.concat(chunks); const key = `generated/video/${input.jobId}.mp4`;
  const { client, bucket } = privateStorageClient();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType, CacheControl: "private, no-store" }));
  const externalId = `media-generation:${input.jobId}`;
  const existing = await prisma.asset.findUnique({ where: { source_externalId: { source: AssetSource.manual, externalId } }, select: { id: true } });
  const id = existing?.id ?? randomUUID(); const fileUrl = privateAssetUrl(id);
  const metadata = { storage: "private-s3", objectKey: key, generatedBy: "runway", generationJobId: input.jobId, targetType: input.targetType, targetId: input.targetId } as Prisma.InputJsonValue;
  return prisma.asset.upsert({ where: { source_externalId: { source: AssetSource.manual, externalId } },
    create: { id, source: AssetSource.manual, externalId, title: input.title, fileUrl, mimeType: contentType, mediaType: "video", fileSize: bytes.length, metadata, tags: [], syncedAt: new Date() },
    update: { title: input.title, fileUrl, mimeType: contentType, mediaType: "video", fileSize: bytes.length, metadata, syncedAt: new Date() } });
}
