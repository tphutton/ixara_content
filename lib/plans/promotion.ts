import {
  BlogStatus,
  ContentPlanItemStatus,
  ContentPlanItemType,
  ContentStatus,
  ContentType,
  ScheduleStatus,
  type UserAccess,
} from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import {
  applyBrandRulesToBlog,
  applyBrandRulesToContent,
} from "@/lib/brand-profiles/rules";
import {
  getEffectiveProductionBrief,
  getPlanItemBriefReadiness,
} from "@/lib/plans/brief-readiness";
import { prisma } from "@/lib/prisma";

export type PlanPromotionTarget = "content" | "blog" | "schedule";

function promotionPrompt(input: {
  planTitle: string;
  itemTitle: string;
  objective: string | null;
  audience: string | null;
  keyMessage: string | null;
  callToAction: string | null;
  tone: string | null;
}) {
  return [
    `Promoted from content plan "${input.planTitle}" item "${input.itemTitle}".`,
    input.objective ? `Objective: ${input.objective}` : null,
    input.audience ? `Audience: ${input.audience}` : null,
    input.keyMessage ? `Key message: ${input.keyMessage}` : null,
    input.callToAction ? `Call to action: ${input.callToAction}` : null,
    input.tone ? `Tone: ${input.tone}` : null,
  ].filter(Boolean).join("\n");
}

async function createContentFromItem(input: {
  planTitle: string;
  item: {
    id: string;
    title: string;
    brief: string | null;
    objective: string | null;
    targetAudience: string | null;
    keyMessage: string | null;
    callToAction: string | null;
    tone: string | null;
    channel: string | null;
    brand: string | null;
    sport: string | null;
    region: string | null;
    country: string | null;
    campaignName: string | null;
  };
  access: UserAccess;
  source: "manual" | "ai";
  effective: ReturnType<typeof getEffectiveProductionBrief>;
}) {
  const prepared = {
    title: input.item.title,
    body: input.item.brief,
    hook: input.effective.keyMessage,
    cta: input.effective.callToAction,
    contentType: ContentType.social_post,
    platform: input.item.channel,
    status: ContentStatus.draft,
    campaignName: input.effective.campaignName,
    brand: input.effective.brand,
    sport: input.item.sport,
    region: input.item.region,
    country: input.item.country,
    tags: [],
    targetAudience: input.effective.targetAudience,
    tone: input.effective.tone,
    websites: [],
    assetImage: null,
    assetCaption: null,
    primaryAssetId: null,
    aiGenerated: true,
    sourcePrompt: promotionPrompt({
      planTitle: input.planTitle,
      itemTitle: input.item.title,
      objective: input.effective.objective,
      audience: input.effective.targetAudience,
      keyMessage: input.effective.keyMessage,
      callToAction: input.effective.callToAction,
      tone: input.effective.tone,
    }),
    createdById: input.access.id,
    updatedById: input.access.id,
  };

  const { data, profile, warnings } = await applyBrandRulesToContent(prepared);
  const content = await prisma.content.create({ data });

  await createActionLog({
    userId: input.access.id,
    actionType: "create",
    targetType: "content",
    targetId: content.id,
    summary: `Promoted plan item "${input.item.title}" into content "${content.title}"${profile ? ` using ${profile.brandName} rules` : ""}`,
    afterData: {
      ...content,
      sourcePlanItemId: input.item.id,
      brandWarnings: warnings,
    },
    source: input.source,
  });

  return content;
}

async function createBlogFromItem(input: {
  planTitle: string;
  item: {
    id: string;
    title: string;
    brief: string | null;
    objective: string | null;
    targetAudience: string | null;
    keyMessage: string | null;
    callToAction: string | null;
    tone: string | null;
    brand: string | null;
    sport: string | null;
    region: string | null;
    country: string | null;
    campaignName: string | null;
  };
  access: UserAccess;
  source: "manual" | "ai";
  effective: ReturnType<typeof getEffectiveProductionBrief>;
}) {
  const prepared = {
    title: input.item.title,
    brand: input.effective.brand,
    postDate: null,
    authorName: null,
    authorImage: null,
    featureImage: null,
    featureAssetId: null,
    text1: [input.effective.keyMessage, input.item.brief].filter(Boolean).join("\n\n") || null,
    image1: null,
    image1Caption: null,
    text2: null,
    image2: null,
    image2Caption: null,
    text3: null,
    image3: null,
    image3Caption: null,
    text4: null,
    image4: null,
    image4Caption: null,
    text5: null,
    image5: null,
    image5Caption: null,
    text6: null,
    image6: null,
    image6Caption: null,
    text7: null,
    image7: null,
    image7Caption: null,
    text8: null,
    image8: null,
    image8Caption: null,
    websites: [],
    category: input.effective.campaignName,
    tags: [],
    authorBio: null,
    status: BlogStatus.draft,
    sport: input.item.sport,
    region: input.item.region,
    country: input.item.country,
    sources: [],
    aiGenerated: true,
    sourcePrompt: promotionPrompt({
      planTitle: input.planTitle,
      itemTitle: input.item.title,
      objective: input.effective.objective,
      audience: input.effective.targetAudience,
      keyMessage: input.effective.keyMessage,
      callToAction: input.effective.callToAction,
      tone: input.effective.tone,
    }),
    createdById: input.access.id,
    updatedById: input.access.id,
  };

  const { data, profile, warnings } = await applyBrandRulesToBlog(prepared);
  const blog = await prisma.blog.create({ data });

  await createActionLog({
    userId: input.access.id,
    actionType: "create",
    targetType: "blog",
    targetId: blog.id,
    summary: `Promoted plan item "${input.item.title}" into blog "${blog.title}"${profile ? ` using ${profile.brandName} rules` : ""}`,
    afterData: {
      ...blog,
      sourcePlanItemId: input.item.id,
      brandWarnings: warnings,
    },
    source: input.source,
  });

  return blog;
}

export async function promoteContentPlanItem(input: {
  planItemId: string;
  target: PlanPromotionTarget;
  access: UserAccess;
  source: "manual" | "ai";
}) {
  const item = await prisma.contentPlanItem.findUniqueOrThrow({
    where: { id: input.planItemId },
    include: {
      plan: true,
      content: true,
      blog: true,
      schedule: true,
    },
  });

  let content = item.content;
  let blog = item.blog;
  const brand = item.brand ?? item.plan.brand;
  const profile = brand
    ? await prisma.brandProfile.findFirst({
        where: { brandName: { equals: brand, mode: "insensitive" } },
        select: { targetAudience: true, defaultTone: true, preferredCTAs: true },
      })
    : null;
  const effective = getEffectiveProductionBrief(item, item.plan, profile);
  const briefReadiness = getPlanItemBriefReadiness(item, item.plan, profile);

  if (!briefReadiness.ready) {
    throw new Error(
      `Complete the production brief before promotion. Missing: ${briefReadiness.missing.map((gap) => gap.label).join(", ")}.`,
    );
  }

  if (input.target === "content" && !content) {
    content = await createContentFromItem({
      planTitle: item.plan.title,
      item,
      access: input.access,
      source: input.source,
      effective,
    });
  }

  if (input.target === "blog" && !blog) {
    blog = await createBlogFromItem({
      planTitle: item.plan.title,
      item,
      access: input.access,
      source: input.source,
      effective,
    });
  }

  if (input.target === "schedule") {
    if (!content && !blog) {
      if (item.itemType === ContentPlanItemType.blog) {
        blog = await createBlogFromItem({
          planTitle: item.plan.title,
          item,
          access: input.access,
          source: input.source,
          effective,
        });
      } else {
        content = await createContentFromItem({
          planTitle: item.plan.title,
          item,
          access: input.access,
          source: input.source,
          effective,
        });
      }
    }

    if (!item.scheduledFor) {
      throw new Error("A scheduled date is required before promoting a plan item into schedule.");
    }
  }

  const updatedItem = await prisma.contentPlanItem.update({
    where: { id: item.id },
    data: {
      contentId: content?.id ?? item.contentId,
      blogId: blog?.id ?? item.blogId,
      status:
        input.target === "schedule"
          ? ContentPlanItemStatus.scheduled
          : ContentPlanItemStatus.created,
    },
  });

  let schedule = item.schedule;

  if (input.target === "schedule" && !schedule) {
    schedule = await prisma.contentSchedule.create({
      data: {
        contentId: content?.id ?? null,
        blogId: blog?.id ?? null,
        scheduledFor: item.scheduledFor as Date,
        channel: item.channel,
        status: ScheduleStatus.planned,
        campaignName: effective.campaignName,
        brand: effective.brand,
        sport: item.sport,
        region: item.region,
        country: item.country,
        notes: `Promoted from plan "${item.plan.title}". ${effective.objective ? `Objective: ${effective.objective}. ` : ""}${item.brief ?? ""}`.trim(),
        createdById: input.access.id,
      },
    });

    await prisma.contentPlanItem.update({
      where: { id: item.id },
      data: {
        scheduleId: schedule.id,
        status: ContentPlanItemStatus.scheduled,
      },
    });

    await createActionLog({
      userId: input.access.id,
      actionType: "create",
      targetType: "schedule",
      targetId: schedule.id,
      summary: `Promoted plan item "${item.title}" into schedule`,
      afterData: {
        ...schedule,
        sourcePlanItemId: item.id,
      },
      source: input.source,
    });
  }

  await createActionLog({
    userId: input.access.id,
    actionType: "update",
    targetType: "content_plan_item",
    targetId: item.id,
    summary: `Promoted plan item "${item.title}" to ${input.target}`,
    beforeData: item,
    afterData: updatedItem,
    source: input.source,
  });

  return {
    item: updatedItem,
    content,
    blog,
    schedule,
  };
}
