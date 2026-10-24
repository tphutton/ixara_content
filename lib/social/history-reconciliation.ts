import { prisma } from "@/lib/prisma";
import { publishedPostBrand } from "@/lib/social/reporting";

type HistorySchedule = {
  id: string; status: string; channel: string | null; brand: string | null;
  contentId: string | null; blogId: string | null; scheduledFor: Date;
  publishedPosts: { id: string }[];
};
type HistoryPost = {
  id: string; status: string; platform: string; externalPostId: string | null;
  importedAt: Date | null; publishedAt: Date | null; scheduleId: string | null;
  contentId: string | null; blogId: string | null;
  sourceBrandName?: string | null; sourceExternalAccountId?: string | null;
  connectedAccount?: { externalAccountId: string | null; brandName: string | null; brandProfile: { brandName: string } | null } | null;
  content?: { brand: string | null } | null; blog?: { brand: string | null } | null;
};

export function validateHistoryArgs(args: Record<string, unknown>) {
  if (Object.keys(args).some((key) => !["id", "publishedPostId", "historyNote"].includes(key))) {
    throw new Error("Historical reconciliation cannot change editorial fields, dates or publication status.");
  }
  if (typeof args.id !== "string" || !args.id.trim()) throw new Error("Schedule ID is required.");
  for (const key of ["publishedPostId", "historyNote"]) {
    if (args[key] !== undefined && (typeof args[key] !== "string" || !args[key].trim())) throw new Error(`${key} cannot be blank.`);
  }
  if (typeof args.historyNote === "string" && args.historyNote.length > 2000) throw new Error("History notes must be at most 2000 characters.");
  if (!args.publishedPostId && !args.historyNote) throw new Error("Supply publication evidence or a history note.");
}

export function validateHistoryLink(schedule: HistorySchedule, post: HistoryPost) {
  if (schedule.status !== "published") throw new Error("Only already-published schedules can be reconciled.");
  const channel = schedule.channel?.trim().toLowerCase();
  const platform = channel === "facebook" ? "facebook" : ["instagram", "instagram reels"].includes(channel ?? "") ? "instagram" : null;
  if (!platform || post.platform !== platform) throw new Error("Publication evidence must match the feed channel; Stories need separate evidence.");
  if (!["published", "imported"].includes(post.status) || !post.externalPostId || !post.importedAt || !post.publishedAt) throw new Error("Evidence must be an imported provider post with an actual publication date.");
  if (!schedule.brand || publishedPostBrand(post)?.toLowerCase() !== schedule.brand.toLowerCase()) throw new Error("Publication evidence must belong to the same brand.");
  if (Math.abs(schedule.scheduledFor.getTime() - post.publishedAt.getTime()) > 24 * 60 * 60 * 1000) throw new Error("Publication evidence must be within one day of the original slot.");
  if (post.scheduleId && post.scheduleId !== schedule.id) throw new Error("This post is already linked to another schedule.");
  if (schedule.publishedPosts.some((item) => item.id !== post.id)) throw new Error("This schedule already has different publication evidence.");
  for (const key of ["contentId", "blogId"] as const) {
    if (post[key] && post[key] !== schedule[key]) throw new Error("Publication evidence has a conflicting editorial link.");
  }
}

export async function reconcilePublishedSchedule(args: Record<string, unknown>, userId: string) {
  validateHistoryArgs(args);
  return prisma.$transaction(async (tx) => {
    const schedule = await tx.contentSchedule.findUniqueOrThrow({ where: { id: args.id as string }, include: { publishedPosts: { select: { id: true } } } });
    if (schedule.status !== "published") throw new Error("Only already-published schedules can be reconciled.");
    const post = args.publishedPostId ? await tx.publishedPost.findUniqueOrThrow({
      where: { id: args.publishedPostId as string },
      include: { content: { select: { brand: true } }, blog: { select: { brand: true } }, connectedAccount: { select: { accountName: true, externalAccountId: true, brandName: true, brandProfile: { select: { brandName: true } } } } },
    }) : null;
    if (post) validateHistoryLink(schedule, post);
    if (post) await tx.publishedPost.update({ where: { id: post.id }, data: {
      scheduleId: schedule.id, contentId: post.contentId ?? schedule.contentId, blogId: post.blogId ?? schedule.blogId,
    } });
    const proof = post ? `Publication verified against imported ${post.platform} post ${post.externalPostId}, published ${post.publishedAt!.toISOString()}. Original planned date retained.` : null;
    const notes = [schedule.notes, proof, args.historyNote as string | undefined].filter((value): value is string => Boolean(value));
    const updated = await tx.contentSchedule.update({ where: { id: schedule.id }, data: {
      notes: [...new Set(notes)].join("\n\n"),
      platformAccount: post ? post.platformAccountName ?? post.connectedAccount?.accountName ?? schedule.platformAccount : schedule.platformAccount,
    } });
    await tx.contentActionLog.create({ data: { userId, actionType: "reconcile_history", targetType: "schedule", targetId: schedule.id,
      summary: post ? "Linked existing imported publication to historical schedule" : "Annotated manually recorded publication history",
      beforeData: JSON.parse(JSON.stringify({ schedule, post: post ? { id: post.id, scheduleId: post.scheduleId, contentId: post.contentId, blogId: post.blogId } : null })),
      afterData: JSON.parse(JSON.stringify({ schedule: updated, publishedPostId: post?.id ?? null })), source: "mcp" } });
    return { toolName: "update_schedule_entry", summary: "Reconciled published history without changing publication status.", payload: { id: schedule.id, status: updated.status, publishedPostId: post?.id ?? null } };
  });
}

export function scheduleHistoryTitle(row: {
  content?: { title: string } | null; blog?: { title: string } | null;
  publishedPosts?: { titleSnapshot: string | null }[];
  status: string; channel: string | null; scheduledFor: Date;
}) {
  return row.content?.title ?? row.blog?.title ?? row.publishedPosts?.[0]?.titleSnapshot ??
    (row.status === "published" ? `Legacy ${row.channel ?? "publication"} entry — ${row.scheduledFor.toISOString().slice(0, 10)}` : "Untitled link");
}
