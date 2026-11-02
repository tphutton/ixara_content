import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { privateObjectKey, privateStorageClient } from "@/lib/media/private-storage";

// Runway accepts data URIs, avoiding public URLs and expiring access tokens.
export async function loadApprovedBrandImage(referenceId: string, assetId: string): Promise<string> {
  const reference = await prisma.brandKitReference.findFirst({ where: { id: referenceId, assetId, status: "approved" }, include: { asset: true } });
  const asset = reference?.asset;
  const key = privateObjectKey(asset?.metadata);
  const mime = asset?.mimeType;
  if (!asset || !key || !mime || !["image/png", "image/jpeg", "image/webp"].includes(mime)) throw new Error("Approved private image reference is unavailable.");
  const { client, bucket } = privateStorageClient();
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const limit = 3_700_000; // encoded data URI must remain under Runway's 5 MB limit
  if (!object.Body || (object.ContentLength !== undefined && object.ContentLength > limit)) throw new Error("Reference image is too large for Runway.");
  const chunks: Uint8Array[] = []; let total = 0;
  for await (const chunk of object.Body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength;
    if (total > limit) throw new Error("Reference image is too large for Runway.");
    chunks.push(chunk);
  }
  return `data:${mime};base64,${Buffer.concat(chunks).toString("base64")}`;
}
