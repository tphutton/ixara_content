import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: null as unknown, send: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/user-access", () => ({ getCurrentUserAccess: async () => state.user }));
vi.mock("@/lib/prisma", () => ({ prisma: { asset: { create: state.create } } }));
vi.mock("@/lib/media/private-storage", async (original) => ({ ...(await original<object>()), privateStorageClient: () => ({ bucket: "private", client: { send: state.send } }) }));
import { POST } from "@/app/api/assets/upload/route";
function req(type = "audio/mpeg") { const f = new FormData(); f.set("file", new File(["example"], "sample.mp3", { type })); return new Request("https://app.test/api/assets/upload", { method: "POST", body: f, headers: { "content-length": "300" } }); }
describe("private media uploads", () => {
  beforeEach(() => { state.user = null; state.send.mockReset(); state.create.mockReset(); });
  it("denies unauthorised and viewer users", async () => {
    expect((await POST(req())).status).toBe(403);
    state.user = { approvalStatus: "approved", role: "viewer" }; expect((await POST(req())).status).toBe(403);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("rejects unsupported file types before storage", async () => {
    state.user = { approvalStatus: "approved", role: "editor", id: "u" }; expect((await POST(req("text/html"))).status).toBe(400); expect(state.send).not.toHaveBeenCalled();
  });
  it("stores an approved audio file privately and records an authenticated URL", async () => {
    state.user = { approvalStatus: "approved", role: "editor", id: "u" }; state.send.mockResolvedValue({}); state.create.mockImplementation(async ({ data }) => data);
    const r = await POST(req()); expect(r.status).toBe(201); const body = await r.json(); expect(body.url).toMatch(/^\/api\/assets\/.+\/file$/); expect(state.send).toHaveBeenCalledOnce(); expect(state.create.mock.calls[0][0].data.metadata.storage).toBe("private-s3");
  });
});
