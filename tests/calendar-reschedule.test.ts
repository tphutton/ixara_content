import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bangkokDateTime,
  moveToBangkokDay,
} from "@/lib/schedule/reschedule-time";
const { tx } = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    contentSchedule: { findMany: vi.fn(), update: vi.fn() },
    contentPlanItem: { updateMany: vi.fn() },
    editorialApproval: { updateMany: vi.fn() },
    contentActionLog: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (fn: (v: unknown) => unknown) => fn(tx),
    contentActionLog: tx.contentActionLog,
  },
}));
import { rescheduleEntries, undoScheduleMove } from "@/lib/schedule/reschedule";
const stamp = new Date("2026-10-26T10:00:00Z");
const row = {
  id: "ig",
  contentId: "content",
  brand: "Cup",
  channel: "Instagram",
  scheduledFor: new Date("2026-10-28T11:30:00Z"),
  updatedAt: stamp,
  status: "planned",
  publishedPosts: [],
  approvedById: null,
};
const move = {
  id: "ig",
  expectedUpdatedAt: stamp.toISOString(),
  scheduledFor: "2026-10-30T11:30:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  tx.contentSchedule.findMany.mockResolvedValue([row]);
  tx.editorialApproval.updateMany.mockResolvedValue({ count: 0 });
  tx.contentSchedule.update.mockImplementation(async ({ where, data }) => ({
    ...row,
    id: where.id,
    ...data,
    updatedAt: new Date("2026-10-26T11:00:00Z"),
  }));
  tx.contentActionLog.create.mockResolvedValue({ id: "log" });
});
describe("Bangkok rescheduling", () => {
  it("preserves local time and seconds across the UTC day boundary", () => {
    expect(
      moveToBangkokDay("2026-10-26T18:30:15.123Z", "2026-11-02").toISOString(),
    ).toBe("2026-11-01T18:30:15.123Z");
    expect(bangkokDateTime("2026-11-02", "18:30").toISOString()).toBe(
      "2026-11-02T11:30:00.000Z",
    );
  });
  it("rejects invalid calendar days and times", () => {
    expect(() => bangkokDateTime("2026-02-30", "18:30")).toThrow();
    expect(() => bangkokDateTime("2026-11-02", "24:01")).toThrow();
  });
  it("moves a planned post and its linked plan target with an audit record", async () => {
    const r = await rescheduleEntries([move], "owner");
    expect(r.logId).toBe("log");
    expect(r.changes[0].after).toBe("2026-10-30T11:30:00.000Z");
    expect(tx.contentPlanItem.updateMany).toHaveBeenCalledWith({
      where: { scheduleId: "ig" },
      data: { scheduledFor: new Date(move.scheduledFor) },
    });
  });
  it("clears timing approval and returns scheduled work to planned", async () => {
    tx.contentSchedule.findMany.mockResolvedValue([
      { ...row, status: "scheduled", approvedById: "owner" },
    ]);
    expect((await rescheduleEntries([move], "owner")).approvalsCleared).toBe(
      true,
    );
    expect(tx.contentSchedule.update.mock.calls[0][0].data).toMatchObject({
      status: "planned",
      approvedById: null,
    });
    expect(tx.editorialApproval.updateMany.mock.calls[0][0].data.decision).toBe(
      "revoked",
    );
  });
  it.each([
    { status: "published" },
    { status: "cancelled" },
    { publishedPosts: [{ id: "delivery" }] },
    { updatedAt: new Date("2026-10-26T12:00:00Z") },
  ])("rejects immutable or stale records %o", async (patch) => {
    tx.contentSchedule.findMany.mockResolvedValue([{ ...row, ...patch }]);
    await expect(rescheduleEntries([move], "owner")).rejects.toThrow();
    expect(tx.contentSchedule.update).not.toHaveBeenCalled();
  });
  it("moves a same-day FB/IG pair together", async () => {
    tx.contentSchedule.findMany.mockResolvedValue([
      row,
      { ...row, id: "fb", channel: "Facebook" },
    ]);
    const r = await rescheduleEntries([move, { ...move, id: "fb" }], "owner");
    expect(r.changes).toHaveLength(2);
  });
  it("rejects a mismatched pair before writing", async () => {
    tx.contentSchedule.findMany.mockResolvedValue([
      row,
      { ...row, id: "fb", channel: "Facebook", contentId: "other" },
    ]);
    await expect(
      rescheduleEntries([move, { ...move, id: "fb" }], "owner"),
    ).rejects.toThrow();
    expect(tx.contentSchedule.update).not.toHaveBeenCalled();
  });
  it("undo uses saved original dates and the post-move revision", async () => {
    tx.contentSchedule.findMany.mockResolvedValue([
      { ...row, scheduledFor: new Date(move.scheduledFor) },
    ]);
    tx.contentActionLog.findUniqueOrThrow.mockResolvedValue({
      userId: "owner",
      actionType: "reschedule",
      source: "calendar",
      afterData: {
        changes: [
          {
            id: "ig",
            before: "2026-10-28T11:30:00.000Z",
            updatedAt: stamp.toISOString(),
          },
        ],
      },
    });
    await undoScheduleMove("log", "owner");
    expect(
      tx.contentSchedule.update.mock.calls[0][0].data.scheduledFor.toISOString(),
    ).toBe("2026-10-28T11:30:00.000Z");
  });
  it("does not allow undoing another user's move", async () => {
    tx.contentActionLog.findUniqueOrThrow.mockResolvedValue({
      userId: "other",
    });
    await expect(undoScheduleMove("log", "owner")).rejects.toThrow();
    expect(tx.contentSchedule.update).not.toHaveBeenCalled();
  });
});
