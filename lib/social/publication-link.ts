import { prisma } from "@/lib/prisma";
import { publishedPostBrand } from "./reporting";

export function assertPublicationEvidence(
  post: {
    status: string;
    externalPostId: string | null;
    importedAt: Date | null;
    publishedAt: Date | null;
  },
  sourceBrand: string | null,
  targetBrand: string | null,
) {
  if (
    !["published", "imported"].includes(post.status) ||
    !post.externalPostId ||
    !post.importedAt ||
    !post.publishedAt
  )
    throw new Error(
      "An imported provider post with a publication timestamp is required.",
    );
  if (
    !sourceBrand ||
    !targetBrand ||
    sourceBrand.toLowerCase() !== targetBrand.toLowerCase()
  )
    throw new Error("Publication and content must belong to the same brand.");
}
/** Evidence-driven history only. Never publishes or changes editorial approval. */
export async function linkImportedPublication(
  args: {
    publishedPostId: string;
    contentId: string;
    scheduleId?: string;
    variantLabel?: string;
  },
  userId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const post = await tx.publishedPost.findUniqueOrThrow({
        where: { id: args.publishedPostId },
        include: {
          content: { select: { brand: true } },
          connectedAccount: {
            select: {
              externalAccountId: true,
              brandName: true,
              brandProfile: { select: { brandName: true } },
            },
          },
        },
      });
      const content = await tx.content.findUniqueOrThrow({
        where: { id: args.contentId },
      });
      if (!["facebook", "instagram"].includes(post.platform))
        throw new Error("Only Meta feed publications can be reconciled here.");
      const sourceBrand = post.sourceBrandName ?? publishedPostBrand(post);
      assertPublicationEvidence(post, sourceBrand, content.brand);
      if (post.blogId || (post.contentId && post.contentId !== content.id))
        throw new Error("Publication already has a different editorial link.");
      // Idempotent retry: never duplicate history or overwrite an existing schedule.
      if (post.scheduleId) {
        const slot = await tx.contentSchedule.findUniqueOrThrow({
          where: { id: post.scheduleId },
        });
        if (slot.contentId !== content.id || slot.status !== "published")
          throw new Error(
            "Publication already belongs to another schedule; review it manually.",
          );
        return {
          publishedPostId: post.id,
          scheduleId: slot.id,
          contentId: content.id,
          alreadyLinked: true,
        };
      }
      const label = args.variantLabel?.trim();
      if (label && label.length > 120)
        throw new Error("Variant label must be at most 120 characters.");
      const existingSlot = args.scheduleId
        ? await tx.contentSchedule.findUniqueOrThrow({
            where: { id: args.scheduleId },
            include: { publishedPosts: { select: { id: true } } },
          })
        : null;
      if (
        existingSlot &&
        (existingSlot.contentId !== content.id ||
          existingSlot.blogId ||
          existingSlot.brand?.toLowerCase() !== sourceBrand?.toLowerCase() ||
          existingSlot.channel?.toLowerCase() !== post.platform ||
          existingSlot.publishedPosts.length > 0 ||
          existingSlot.status === "cancelled")
      )
        throw new Error(
          "Choose an unlinked, active schedule for the same content, brand and platform.",
        );
      const evidenceNote = `Verified imported ${post.platform} publication ${post.externalPostId}. Actual publication: ${post.publishedAt!.toISOString()}.${label ? ` Creative variant: ${label}.` : ""}`;
      const schedule = existingSlot
        ? await tx.contentSchedule.update({
            where: { id: existingSlot.id },
            data: {
              status: "published",
              notes: [existingSlot.notes, evidenceNote]
                .filter(Boolean)
                .join("\n\n"),
            },
          })
        : await tx.contentSchedule.create({
            data: {
              contentId: content.id,
              scheduledFor: post.publishedAt!,
              status: "published",
              brand: sourceBrand,
              channel: post.platform === "instagram" ? "Instagram" : "Facebook",
              platformAccount: post.platformAccountName,
              campaignName: content.campaignName,
              sport: content.sport,
              region: content.region,
              country: content.country,
              createdById: userId,
              notes: evidenceNote,
            },
          });
      await tx.publishedPost.update({
        where: { id: post.id },
        data: {
          scheduleId: schedule.id,
          contentId: content.id,
          updatedById: userId,
        },
      });
      await tx.contentActionLog.create({
        data: {
          userId,
          actionType: "reconcile_history",
          targetType: "published_post",
          targetId: post.id,
          summary:
            "Linked imported provider evidence to editorial content and publication history",
          beforeData: {
            contentId: post.contentId,
            scheduleId: post.scheduleId,
          },
          afterData: {
            contentId: content.id,
            scheduleId: schedule.id,
            externalPostId: post.externalPostId,
            variantLabel: label ?? null,
          },
          source: "publication-reconciliation",
        },
      });
      return {
        publishedPostId: post.id,
        scheduleId: schedule.id,
        contentId: content.id,
        alreadyLinked: false,
      };
    },
    { isolationLevel: "Serializable" },
  );
}
