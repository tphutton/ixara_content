import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { AssetSource, ApprovalStatus, UserRole } from "@prisma/client";
import { getCurrentUserAccess } from "@/lib/auth/user-access";
import { prisma } from "@/lib/prisma";
import { privateAssetUrl, privateStorageClient } from "@/lib/media/private-storage";

export const runtime = "nodejs";
const LIMIT = 50 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mp4": "m4a", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
export async function POST(request: Request) {
  const user = await getCurrentUserAccess();
  if (!user || user.approvalStatus !== ApprovalStatus.approved || user.role === UserRole.viewer) return Response.json({ error: "Not authorised" }, { status: 403 });
  const size = Number(request.headers.get("content-length"));
  if (!size || size > LIMIT + 1024 * 1024) return Response.json({ error: "Upload must be under 50 MB." }, { status: 413 });
  const data = await request.formData();
  const file = data.get("file");
  if (!(file instanceof File) || !file.size || file.size > LIMIT || !TYPES[file.type]) return Response.json({ error: "Choose a PNG, JPEG, WebP, MP3, WAV, M4A, MP4, MOV or WebM file under 50 MB." }, { status: 400 });
  const id = randomUUID(); const key = `uploads/${id}.${TYPES[file.type]}`;
  const { client, bucket } = privateStorageClient();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: file.type, CacheControl: "private, no-store" }));
  const asset = await prisma.asset.create({ data: { id, source: AssetSource.manual, title: file.name.slice(0, 200), fileUrl: privateAssetUrl(id), mimeType: file.type, mediaType: file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "video", fileSize: file.size, tags: [], metadata: { storage: "private-s3", objectKey: key }, createdById: user.id, updatedById: user.id } });
  return Response.json({ id: asset.id, url: asset.fileUrl }, { status: 201 });
}
