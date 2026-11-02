import { describe, expect, it } from "vitest";
import { privateAssetUrl, privateObjectKey } from "@/lib/media/private-storage";

describe("private media references", () => {
  it("only accepts storage-owned asset keys", () => {
    expect(privateObjectKey({ storage: "private-s3", objectKey: "uploads/abc-123.mp3" })).toBe("uploads/abc-123.mp3");
    expect(privateObjectKey({ storage: "private-s3", objectKey: "generated/video/abc.mp4" })).toBe("generated/video/abc.mp4");
    for (const value of [null, {}, { storage: "private-s3", objectKey: "uploads/../../secret.mp4" }, { storage: "other", objectKey: "uploads/x.mp4" }, { storage: "private-s3", objectKey: "https://evil.test/x.mp4" }]) expect(privateObjectKey(value)).toBeNull();
  });
  it("returns an authenticated route rather than a public bucket URL", () => {
    expect(privateAssetUrl("abc-123")).toBe("/api/assets/abc-123/file");
  });
});
