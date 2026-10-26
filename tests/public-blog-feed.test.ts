import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { blog: db } }));
import { listPublishedWebsiteBlogsForApi } from "@/lib/blogs/api";
import { GET } from "@/app/api/public/blogs/[website]/route";

beforeEach(() => { db.findMany.mockReset().mockResolvedValue([]); db.count.mockReset().mockResolvedValue(0); });
describe("published website feed", () => {
  it("requires an exact website assignment, published status and an elapsed publication date", async () => {
    const now = new Date("2026-10-26T00:00:00Z");
    await listPublishedWebsiteBlogsForApi({ website: "Eagles & Aces Cup", page: 2, limit: 10 }, now);
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { websites: { has: "Eagles & Aces Cup" }, status: "published", postDate: { lte: now } }, skip: 10, take: 10,
    }));
    expect(db.count).toHaveBeenCalledWith({ where: { websites: { has: "Eagles & Aces Cup" }, status: "published", postDate: { lte: now } } });
  });
  it("returns public article fields without editorial or account metadata", async () => {
    const date = new Date("2026-01-01");
    db.findMany.mockResolvedValue([{ id: "article", title: "Story", postDate: date, websites: ["Eagles & Aces Cup"], status: "published", sources: [], tags: [], createdAt: date, updatedAt: date, legacyZohoId: "private-reference", sourcePrompt: "internal", createdById: "editor" }]);
    db.count.mockResolvedValue(1);
    const result = await listPublishedWebsiteBlogsForApi({ website: "Eagles & Aces Cup" });
    expect(result.records[0]).toMatchObject({ title: "Story", status: "Live" });
    for (const key of ["zoho_id", "sourcePrompt", "createdById"]) expect(result.records[0]).not.toHaveProperty(key);
  });
  it("query parameters cannot opt into drafts or another website", async () => {
    const response = await GET(new Request("https://content.ixara.tech/api/public/blogs/Eagles%20%26%20Aces%20Cup?status=draft&include_drafts=true&website=StadioMate"), { params: Promise.resolve({ website: "Eagles & Aces Cup" }) });
    expect(response.status).toBe(200);
    expect(db.findMany.mock.calls[0][0].where).toMatchObject({ websites: { has: "Eagles & Aces Cup" }, status: "published" });
    expect((await response.json()).records).toEqual([]);
  });
  it("rejects unknown destinations without querying the database", async () => {
    const response = await GET(new Request("https://content.ixara.tech/api/public/blogs/unknown"), { params: Promise.resolve({ website: "unknown" }) });
    expect(response.status).toBe(404); expect(db.findMany).not.toHaveBeenCalled();
  });
});
