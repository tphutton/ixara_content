import { beforeEach, describe, expect, it, vi } from "vitest";
const { tx } = vi.hoisted(() => ({
  tx: {
    publishedPost: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    content: { findUniqueOrThrow: vi.fn() },
    contentSchedule: {
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contentActionLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn(tx) },
}));
import { linkImportedPublication } from "@/lib/social/publication-link";
const post = {
  id: "post",
  status: "published",
  platform: "instagram",
  externalPostId: "meta-1",
  importedAt: new Date(),
  publishedAt: new Date("2026-10-26T07:00:00Z"),
  sourceBrandName: "Cup",
  contentId: null,
  blogId: null,
  scheduleId: null,
  platformAccountName: "Cup IG",
};
beforeEach(() => {
  vi.resetAllMocks();
  tx.publishedPost.findUniqueOrThrow.mockResolvedValue(post);
  tx.content.findUniqueOrThrow.mockResolvedValue({
    id: "content",
    brand: "Cup",
    campaignName: "Launch",
  });
  tx.contentSchedule.create.mockResolvedValue({ id: "history" });
});
describe("imported publication transaction", () => {
  it("uses provider timestamp and links without changing editorial approval or caption", async () => {
    await linkImportedPublication(
      { publishedPostId: "post", contentId: "content" },
      "actor",
    );
    expect(tx.contentSchedule.create.mock.calls[0][0].data).toMatchObject({
      status: "published",
      scheduledFor: post.publishedAt,
      contentId: "content",
    });
    expect(tx.publishedPost.update).toHaveBeenCalledWith({
      where: { id: "post" },
      data: {
        scheduleId: "history",
        contentId: "content",
        updatedById: "actor",
      },
    });
    expect(tx.contentActionLog.create).toHaveBeenCalledTimes(1);
  });
  it("is idempotent for an already linked post", async () => {
    tx.publishedPost.findUniqueOrThrow.mockResolvedValue({
      ...post,
      contentId: "content",
      scheduleId: "history",
    });
    tx.contentSchedule.findUniqueOrThrow.mockResolvedValue({
      id: "history",
      contentId: "content",
      status: "published",
    });
    expect(
      await linkImportedPublication(
        { publishedPostId: "post", contentId: "content" },
        "actor",
      ),
    ).toMatchObject({ alreadyLinked: true });
    expect(tx.contentSchedule.create).not.toHaveBeenCalled();
    expect(tx.publishedPost.update).not.toHaveBeenCalled();
  });
  it("rejects a conflicting editorial link or brand", async () => {
    tx.publishedPost.findUniqueOrThrow.mockResolvedValue({
      ...post,
      contentId: "other",
    });
    await expect(
      linkImportedPublication(
        { publishedPostId: "post", contentId: "content" },
        "actor",
      ),
    ).rejects.toThrow();
    tx.publishedPost.findUniqueOrThrow.mockResolvedValue({
      ...post,
      sourceBrandName: "Other",
    });
    await expect(
      linkImportedPublication(
        { publishedPostId: "post", contentId: "content" },
        "actor",
      ),
    ).rejects.toThrow();
    expect(tx.contentSchedule.create).not.toHaveBeenCalled();
  });
  it("reuses an explicitly selected active matching planned slot", async () => {
    tx.contentSchedule.findUniqueOrThrow.mockResolvedValue({
      id: "slot",
      contentId: "content",
      blogId: null,
      brand: "Cup",
      channel: "Instagram",
      publishedPosts: [],
      status: "planned",
      notes: "Original target",
    });
    tx.contentSchedule.update.mockResolvedValue({ id: "slot" });
    await linkImportedPublication(
      { publishedPostId: "post", contentId: "content", scheduleId: "slot" },
      "actor",
    );
    expect(tx.contentSchedule.create).not.toHaveBeenCalled();
    expect(tx.contentSchedule.update.mock.calls[0][0].data).not.toHaveProperty(
      "scheduledFor",
    );
    expect(tx.contentSchedule.update.mock.calls[0][0].data.status).toBe(
      "published",
    );
  });
  it("refuses another channel or a slot with existing evidence", async () => {
    tx.contentSchedule.findUniqueOrThrow.mockResolvedValue({
      id: "slot",
      contentId: "content",
      brand: "Cup",
      channel: "Facebook",
      publishedPosts: [],
      status: "planned",
    });
    await expect(
      linkImportedPublication(
        { publishedPostId: "post", contentId: "content", scheduleId: "slot" },
        "actor",
      ),
    ).rejects.toThrow();
    expect(tx.contentSchedule.update).not.toHaveBeenCalled();
  });
});
