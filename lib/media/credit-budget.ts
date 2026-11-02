import { prisma } from "@/lib/prisma";

export async function setPlanMediaBudget(planId: string, creditBudget: number, accessId: string) {
  if (!Number.isSafeInteger(creditBudget) || creditBudget < 0 || creditBudget > 1_000_000) throw new Error("Budget must be a whole number from 0 to 1,000,000 credits.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`media-budget:${planId}`}, 0))::text`;
    const before = await tx.contentPlan.findUniqueOrThrow({ where: { id: planId } });
    const after = await tx.contentPlan.update({ where: { id: planId }, data: { mediaCreditBudget: creditBudget } });
    await tx.contentActionLog.create({ data: { userId: accessId, actionType: "update", targetType: "content_plan", targetId: planId, summary: "Updated production credit budget", beforeData: { mediaCreditBudget: before.mediaCreditBudget }, afterData: { mediaCreditBudget: after.mediaCreditBudget }, source: "manual" } });
    return after;
  });
}
