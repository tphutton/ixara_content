import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: null as unknown, asset: null as unknown, send: vi.fn(), complete: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/user-access", () => ({ getCurrentUserAccess: async () => state.user }));
vi.mock("@/lib/prisma", () => ({ prisma: { asset: { findUnique: async () => state.asset, update: state.update } } }));
vi.mock("@/lib/media/private-storage", async (original) => ({ ...(await original<object>()), privateStorageClient: () => ({ bucket: "private", client: { send: state.send } }) }));
vi.mock("@/lib/openai", () => ({ getOpenAIClient: () => ({ chat: { completions: { create: state.complete } } }) }));
import { POST } from "@/app/api/assets/[id]/review/route";
const req = () => new Request("https://app.test/api/assets/a/review", { method: "POST" });
const ctx = { params: Promise.resolve({ id: "a" }) };
describe("audio review", () => {
  beforeEach(() => { state.user = null; state.asset = null; vi.clearAllMocks(); });
  it("blocks unapproved users and viewers before accessing media", async () => {
    expect((await POST(req(), ctx)).status).toBe(403);
    state.user = { approvalStatus: "approved", role: "viewer" };
    expect((await POST(req(), ctx)).status).toBe(403);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("refuses unsafe keys, unsupported formats and oversized files", async () => {
    state.user = { id: "u", approvalStatus: "approved", role: "editor" };
    state.asset = { metadata: { storage: "private-s3", objectKey: "../secret" }, mediaType: "audio" };
    expect((await POST(req(), ctx)).status).toBe(404);
    state.asset = { metadata: { storage: "private-s3", objectKey: "uploads/a.m4a" }, mediaType: "audio", mimeType: "audio/mp4", fileSize: 10 };
    expect((await POST(req(), ctx)).status).toBe(400);
    state.asset = { metadata: { storage: "private-s3", objectKey: "uploads/a.mp3" }, mediaType: "audio", mimeType: "audio/mpeg", fileSize: 11 * 1024 * 1024 };
    expect((await POST(req(), ctx)).status).toBe(413);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("sends the private audio to OpenAI and saves the review without losing storage metadata", async () => {
    state.user = { id: "u", approvalStatus: "approved", role: "editor" };
    state.asset = { metadata: { storage: "private-s3", objectKey: "uploads/a.mp3" }, mediaType: "audio", mimeType: "audio/mpeg", fileSize: 3 };
    state.send.mockResolvedValue({ ContentLength: 3, Body: { transformToByteArray: async () => new Uint8Array([1,2,3]) } });
    state.complete.mockResolvedValue({ choices: [{ message: { content: "The opening needs more energy." } }] });
    const response = await POST(req(), ctx);
    expect(response.status).toBe(200);
    expect(state.complete.mock.calls[0][0]).toMatchObject({ store: false, modalities: ["text"], messages: [{ content: [{}, { input_audio: { data: "AQID", format: "mp3" } }] }] });
    expect(state.update.mock.calls[0][0].data.metadata).toMatchObject({ storage: "private-s3", objectKey: "uploads/a.mp3", audioReview: { review: "The opening needs more energy." } });
  });
});

describe("audio review failures", () => {
  it("reports storage failure without leaking provider details", async () => {
    state.user = { id: "u", approvalStatus: "approved", role: "editor" };
    state.asset = { metadata: { storage: "private-s3", objectKey: "uploads/a.mp3" }, mediaType: "audio", mimeType: "audio/mpeg", fileSize: 3 };
    state.send.mockRejectedValueOnce(new Error("secret provider details"));
    const response = await POST(req(), ctx);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "Could not read the private audio file." });
  });
});
