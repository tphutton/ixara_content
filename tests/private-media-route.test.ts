import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: null as unknown, asset: null as unknown, send: vi.fn() }));
vi.mock("@/lib/auth/user-access", () => ({ getCurrentUserAccess: async () => state.user }));
vi.mock("@/lib/prisma", () => ({ prisma: { asset: { findUnique: async () => state.asset } } }));
vi.mock("@/lib/media/private-storage", async (importOriginal) => ({ ...(await importOriginal<object>()), privateStorageClient: () => ({ bucket: "private", client: { send: state.send } }) }));
import { GET } from "@/app/api/assets/[id]/file/route";
const ctx = { params: Promise.resolve({ id: "a" }) };
describe("private media playback", () => {
  beforeEach(() => { state.user = null; state.asset = null; state.send.mockReset(); });
  it("refuses unauthenticated and unapproved access", async () => {
    expect((await GET(new Request("https://app.test/api/assets/a/file"), ctx)).status).toBe(403);
    state.user = { approvalStatus: "pending" };
    expect((await GET(new Request("https://app.test/api/assets/a/file"), ctx)).status).toBe(403);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("does not fetch arbitrary object keys", async () => {
    state.user = { approvalStatus: "approved" }; state.asset = { metadata: { storage: "private-s3", objectKey: "../secret" } };
    expect((await GET(new Request("https://app.test/api/assets/a/file"), ctx)).status).toBe(404);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("returns range content only to approved users", async () => {
    state.user = { approvalStatus: "approved" }; state.asset = { metadata: { storage: "private-s3", objectKey: "uploads/test.mp3" }, mimeType: "audio/mpeg" };
    state.send.mockResolvedValue({ Body: { transformToWebStream: () => new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1,2])); c.close(); } }) }, ContentLength: 2, ContentRange: "bytes 0-1/5" });
    const response = await GET(new Request("https://app.test/api/assets/a/file", { headers: { range: "bytes=0-1" } }), ctx);
    expect(response.status).toBe(206); expect(response.headers.get("content-range")).toBe("bytes 0-1/5"); expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
