import { prisma } from "@/lib/prisma";

/** Explicit batch editorial approval; never generates media. */
export async function approveVideoShots(input: { planItemId: string; shotIds: string[]; accessId: string; note: string }) {
  const ids = [...new Set(input.shotIds)];
  if (!ids.length || ids.length > 50 || ids.some(id => !id)) throw new Error("Select between 1 and 50 shots.");
  if (!input.note.trim() || input.note.length > 1000) throw new Error("A short approval note is required.");
  return prisma.$transaction(async tx => {
    const brief = await tx.videoBrief.findUniqueOrThrow({ where: { planItemId: input.planItemId }, select: { id: true } });
    await tx.$queryRaw`SELECT "id" FROM "VideoShot" WHERE "videoBriefId" = ${brief.id} ORDER BY "id" FOR UPDATE`;
    const before = await tx.videoShot.findMany({ where: { id: { in: ids }, videoBriefId: brief.id }, orderBy: { id: "asc" } });
    if (before.length !== ids.length) throw new Error("Every selected shot must belong to this video brief.");
    if (before.some(shot => !["planned", "needs_changes", "approved"].includes(shot.status))) throw new Error("Generating or completed shots cannot be approved.");
    await tx.videoShot.updateMany({ where: { id: { in: ids }, videoBriefId: brief.id, status: { in: ["planned", "needs_changes"] } }, data: { status: "approved" } });
    const after = await tx.videoShot.findMany({ where: { id: { in: ids }, videoBriefId: brief.id }, orderBy: { id: "asc" } });
    if (after.some(shot => shot.status !== "approved")) throw new Error("A shot changed during approval. Review and try again.");
    await tx.contentActionLog.create({ data: { userId: input.accessId, actionType: "approve", targetType: "video_brief", targetId: brief.id, summary: `Approved ${ids.length} video shots: ${input.note.trim()}`, beforeData: JSON.parse(JSON.stringify(before)), afterData: JSON.parse(JSON.stringify(after)), source: "manual" } });
    return { briefId: brief.id, shotIds: after.map(shot => shot.id), approved: after.length };
  });
}
