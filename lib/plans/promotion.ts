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
import { prisma } from "@/lib/prisma";

export type PlanPromotionTarget = "content" | "blog" | "schedule";

function promotionPrompt(planTitle: string, itemTitle: string) {
  return `Promoted from content plan "${planTitle}" item "${itemTitle}".`;
}

async function createContentFromItem(input: {
  planTitle: string;
  item: {
    id: string;
    title: string;
    brief: string | null;
    channel: string | null;
    brand: string | null;
    sport: string | null;
    region: string | null;
    country: string | null;
    campaignName: string | null;
  };
  access: UserAccess;
  source: "manual" | "ai";
}) {
  const prepared = {
    title: input.item.title,
    body: input.item.brief,
    hook: null,
    cta: null,
    contentType: ContentType.social_post,
    platform: input.item.channel,
    status: ContentStatus.draft,
    campaignName: input.item.campaignName,
    brand: input.item.brand,
    sport: input.item.sport,
    region: input.item.region,
    country: input.item.country,
    tags: [],
    targetAudience: null,
    tone: null,
    websites: [],
    assetImage: null,
    assetCaption: null,
    primaryAssetId: null,
    aiGenerated: true,
    sourcePrompt: promotionPrompt(input.planTitle, input.item.title),
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
    brand: string | null;
    sport: string | null;
    region: string | null;
    country: string | null;
    campaignName: string | null;
  };
  access: UserAccess;
  source: "manual" | "ai";
}) {
  const prepared = {
    title: input.item.title,
    brand: input.item.brand,
    postDate: null,
    authorName: null,
    authorImage: null,
    featureImage: null,
    featureAssetId: null,
    text1: input.item.brief,
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
    category: input.item.campaignName,
    tags: [],
    authorBio: null,
    status: BlogStatus.draft,
    sport: input.item.sport,
    region: input.item.region,
    country: input.item.country,
    sources: [],
    aiGenerated: true,
    sourcePrompt: promotionPrompt(input.planTitle, input.item.title),
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

  if (input.target === "content" && !content) {
    content = await createContentFromItem({
      planTitle: item.plan.title,
      item,
      access: input.access,
      source: input.source,
    });
  }

  if (input.target === "blog" && !blog) {
    blog = await createBlogFromItem({
      planTitle: item.plan.title,
      item,
      access: input.access,
      source: input.source,
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
        });
      } else {
        content = await createContentFromItem({
          planTitle: item.plan.title,
          item,
          access: input.access,
          source: input.source,
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
        campaignName: item.campaignName,
        brand: item.brand,
        sport: item.sport,
        region: item.region,
        country: item.country,
        notes: `Promoted from plan "${item.plan.title}". ${item.brief ?? ""}`.trim(),
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
