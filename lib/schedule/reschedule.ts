import { prisma } from "@/lib/prisma";
import { calendarDay } from "./calendar";

export type ScheduleMove = {
  id: string;
  expectedUpdatedAt: string;
  scheduledFor: string;
};
export function assertMovable(
  row: { status: string; updatedAt: Date; publishedPosts: unknown[] },
  expectedUpdatedAt: string,
) {
  if (
    ["published", "cancelled"].includes(row.status) ||
    row.publishedPosts.length
  )
    throw new Error(
      "Published posts and entries with publishing activity cannot be moved. Review the delivery first.",
    );
  if (row.updatedAt.toISOString() !== expectedUpdatedAt)
    throw new Error(
      "This entry changed since you opened the calendar. Refresh and try again.",
    );
}
export async function rescheduleEntries(moves: ScheduleMove[], userId: string) {
  if (
    !Array.isArray(moves) ||
    !moves.length ||
    moves.length > 2 ||
    new Set(moves.map((m) => m.id)).size !== moves.length
  )
    throw new Error("Move one post or its Facebook/Instagram pair.");
  return prisma.$transaction(
    async (tx) => {
      // Share a row lock with delivery claim, so a post cannot start publishing
      // from a stale schedule while its timing is being changed.
      for (const id of moves.map((m) => m.id).sort())
        await tx.$queryRaw`SELECT id FROM "ContentSchedule" WHERE id = ${id} FOR UPDATE`;
      const rows = await tx.contentSchedule.findMany({
        where: { id: { in: moves.map((m) => m.id) } },
        include: { publishedPosts: { select: { id: true } } },
      });
      if (rows.length !== moves.length)
        throw new Error("A calendar entry no longer exists.");
      for (const row of rows)
        assertMovable(
          row,
          moves.find((m) => m.id === row.id)!.expectedUpdatedAt,
        );
      if (rows.length === 2) {
        const [a, b] = rows;
        if (
          !a.contentId ||
          a.contentId !== b.contentId ||
          a.brand !== b.brand ||
          calendarDay(a.scheduledFor) !== calendarDay(b.scheduledFor) ||
          new Set([a.channel?.toLowerCase(), b.channel?.toLowerCase()]).size !==
            2 ||
          ![a.channel?.toLowerCase(), b.channel?.toLowerCase()].every(
            (p) => p === "facebook" || p === "instagram",
          )
        )
          throw new Error(
            "Paired moves require the same content, brand and original day, with one Facebook and one Instagram entry.",
          );
      }
      const changes = [];
      let approvalsCleared = false;
      for (const row of rows) {
        const move = moves.find((m) => m.id === row.id)!;
        const date = new Date(move.scheduledFor);
        if (!Number.isFinite(date.getTime()))
          throw new Error("Invalid schedule time.");
        if (date.getTime() === row.scheduledFor.getTime()) continue;
        const revoked = await tx.editorialApproval.updateMany({
          where: {
            targetType: "schedule",
            targetId: row.id,
            decision: { in: ["approved", "pending"] },
          },
          data: {
            decision: "revoked",
            decisionComment:
              "Timing changed in the publishing calendar. Review the new date before approval.",
            decidedById: userId,
            decidedAt: new Date(),
          },
        });
        approvalsCleared ||= Boolean(
          row.approvedById ||
          revoked.count ||
          ["ready", "scheduled"].includes(row.status),
        );
        const after = await tx.contentSchedule.update({
          where: { id: row.id },
          data: { scheduledFor: date, status: "planned", approvedById: null },
        });
        await tx.contentPlanItem.updateMany({
          where: { scheduleId: row.id },
          data: { scheduledFor: date },
        });
        changes.push({
          id: row.id,
          before: row.scheduledFor.toISOString(),
          after: after.scheduledFor.toISOString(),
          updatedAt: after.updatedAt.toISOString(),
          status: after.status,
        });
      }
      const log = await tx.contentActionLog.create({
        data: {
          userId,
          actionType: "reschedule",
          targetType: "schedule",
          targetId: rows[0].id,
          summary: `Moved ${changes.length} calendar entries`,
          beforeData: changes.map((c) => ({
            id: c.id,
            scheduledFor: c.before,
          })),
          afterData: { changes },
          source: "calendar",
        },
      });
      return { logId: log.id, changes, approvalsCleared };
    },
    { isolationLevel: "ReadCommitted" },
  );
}
export async function undoScheduleMove(logId: string, userId: string) {
  const log = await prisma.contentActionLog.findUniqueOrThrow({
    where: { id: logId },
  });
  if (
    log.userId !== userId ||
    log.actionType !== "reschedule" ||
    log.source !== "calendar"
  )
    throw new Error("This move cannot be undone by this user.");
  const data = log.afterData as {
    changes?: { id: string; before: string; updatedAt: string }[];
  } | null;
  if (!data?.changes?.length) throw new Error("No move to undo.");
  // Uses the same stale-record and publication guards. Approval is never restored.
  return rescheduleEntries(
    data.changes.map((c) => ({
      id: c.id,
      expectedUpdatedAt: c.updatedAt,
      scheduledFor: c.before,
    })),
    userId,
  );
}
