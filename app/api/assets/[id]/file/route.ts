import { GetObjectCommand } from "@aws-sdk/client-s3";
import { ApprovalStatus } from "@prisma/client";
import { getCurrentUserAccess } from "@/lib/auth/user-access";
import { privateObjectKey, privateStorageClient } from "@/lib/media/private-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserAccess();
  if (!user || user.approvalStatus !== ApprovalStatus.approved) return new Response("Not authorised", { status: 403 });
  const { id } = await context.params;
  const asset = await prisma.asset.findUnique({ where: { id }, select: { metadata: true, mimeType: true } });
  const key = privateObjectKey(asset?.metadata);
  if (!asset || !key) return new Response("Not found", { status: 404 });
  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) return new Response("Invalid range", { status: 416 });
  const { client, bucket } = privateStorageClient();
  try {
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: range || undefined }));
    if (!obj.Body) return new Response("Not found", { status: 404 });
    const headers = new Headers({ "Content-Type": obj.ContentType || asset.mimeType || "application/octet-stream", "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" });
    if (obj.ContentLength !== undefined) headers.set("Content-Length", String(obj.ContentLength));
    if (obj.ContentRange) headers.set("Content-Range", obj.ContentRange);
    return new Response(obj.Body.transformToWebStream(), { status: obj.ContentRange ? 206 : 200, headers });
  } catch { return new Response("Media unavailable", { status: 404 }); }
}
