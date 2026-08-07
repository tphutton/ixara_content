import {
  AutomationStatus,
  AutomationType,
  BlogStatus,
  ConnectedAccountStatus,
  ContentPlanItemStatus,
  ContentPlanItemType,
  ContentPlanStatus,
  ContentStatus,
  ContentType,
  PublishedPostStatus,
  QualityReviewTargetType,
  ScheduleStatus,
  SocialPlatform,
  type UserAccess,
} from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { runBlogPostAutomation } from "@/lib/automation/generate-blog-posts";
import { getAutomationHealthSummary, runDueAutomations } from "@/lib/automation/runner";
import { runWeeklySocialAutomation } from "@/lib/automation/generate-weekly-social";
import {
  applyBrandRulesToBlog,
  applyBrandRulesToContent,
} from "@/lib/brand-profiles/rules";
import { getBrandProfileReadiness } from "@/lib/brand-profiles/intelligence";
import {
  deleteCampaign,
  getCampaign,
  listCampaigns,
  upsertCampaign,
} from "@/lib/campaigns/client";
import {
  campaignStatuses,
  campaignTypes,
  type CampaignStatus,
} from "@/lib/campaigns/types";
import { prisma } from "@/lib/prisma";
import { runQualityReview } from "@/lib/quality/editorial-review";

type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type ToolResult = {
  toolName: string;
  summary: string;
  payload: Record<string, unknown>;
};

type ToolContext = {
  access: UserAccess;
};

type ToolHandler = (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asBoolean(value: unknown) {
  return value === true;
}

function asNullableDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asRequiredString(value: unknown, fieldName: string) {
  const parsed = asOptionalString(value);

  if (!parsed) {
    throw new Error(`${fieldName} is required.`);
  }

  return parsed;
}

function parseEnumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

async function listContentTool(args: Record<string, unknown>) {
  const status = asOptionalString(args.status);
  const contentType = asOptionalString(args.contentType);
  const brand = asOptionalString(args.brand);
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 25) : 10;

  const items = await prisma.content.findMany({
    where: {
      status: status ? (status as ContentStatus) : undefined,
      contentType: contentType ? (contentType as ContentType) : undefined,
      brand: brand ?? undefined,
    },
    include: {
      primaryAsset: {
        select: { id: true, title: true, fileUrl: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return {
    toolName: "list_content",
    summary: `Found ${items.length} content record${items.length === 1 ? "" : "s"}.`,
    payload: {
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        contentType: item.contentType,
        platform: item.platform,
        brand: item.brand,
        primaryAsset: item.primaryAsset,
        updatedAt: item.updatedAt.toISOString(),
      })),
    },
  };
}

async function createContentTool(args: Record<string, unknown>, context: ToolContext) {
  const prepared = {
    title: asRequiredString(args.title, "title"),
    body: asOptionalString(args.body),
    hook: asOptionalString(args.hook),
    cta: asOptionalString(args.cta),
    contentType: parseEnumValue(
      args.contentType,
      Object.values(ContentType),
      ContentType.social_post,
    ),
    platform: asOptionalString(args.platform),
    status: parseEnumValue(args.status, Object.values(ContentStatus), ContentStatus.draft),
    campaignName: asOptionalString(args.campaignName),
    brand: asOptionalString(args.brand),
    sport: asOptionalString(args.sport),
    region: asOptionalString(args.region),
    country: asOptionalString(args.country),
    tags: asStringArray(args.tags),
    targetAudience: asOptionalString(args.targetAudience),
    tone: asOptionalString(args.tone),
    websites: asStringArray(args.websites),
    assetImage: asOptionalString(args.assetImage),
    assetCaption: asOptionalString(args.assetCaption),
    primaryAssetId: asOptionalString(args.primaryAssetId),
    aiGenerated: true,
    sourcePrompt: asOptionalString(args.sourcePrompt),
    createdById: context.access.id,
    updatedById: context.access.id,
  };

  const { data, profile, warnings } = await applyBrandRulesToContent(prepared);
  const content = await prisma.content.create({ data });

  await createActionLog({
    userId: context.access.id,
    actionType: "create",
    targetType: "content",
    targetId: content.id,
    summary: `AI created content "${content.title}"${profile ? ` using ${profile.brandName} rules` : ""}${warnings.length > 0 ? ` with ${warnings.length} brand warning${warnings.length === 1 ? "" : "s"}` : ""}`,
    afterData: {
      ...content,
      brandProfileApplied: profile?.brandName ?? null,
      brandWarnings: warnings,
    },
    source: "ai",
  });

  return {
    toolName: "create_content",
    summary: `Created content "${content.title}" (${content.id}).`,
    payload: {
      id: content.id,
      title: content.title,
      status: content.status,
      contentType: content.contentType,
    },
  };
}

async function updateContentTool(args: Record<string, unknown>, context: ToolContext) {
  const id = asRequiredString(args.id, "id");
  const before = await prisma.content.findUniqueOrThrow({ where: { id } });

  const prepared = {
    title: asOptionalString(args.title) ?? undefined,
    body: args.body !== undefined ? asOptionalString(args.body) : undefined,
    hook: args.hook !== undefined ? asOptionalString(args.hook) : undefined,
    cta: args.cta !== undefined ? asOptionalString(args.cta) : undefined,
    contentType:
      args.contentType !== undefined
        ? parseEnumValue(args.contentType, Object.values(ContentType), before.contentType)
        : undefined,
    platform: args.platform !== undefined ? asOptionalString(args.platform) : undefined,
    status:
      args.status !== undefined
        ? parseEnumValue(args.status, Object.values(ContentStatus), before.status)
        : undefined,
    campaignName: args.campaignName !== undefined ? asOptionalString(args.campaignName) : undefined,
    brand: args.brand !== undefined ? asOptionalString(args.brand) : undefined,
    sport: args.sport !== undefined ? asOptionalString(args.sport) : undefined,
    region: args.region !== undefined ? asOptionalString(args.region) : undefined,
    country: args.country !== undefined ? asOptionalString(args.country) : undefined,
    tags: Array.isArray(args.tags) ? asStringArray(args.tags) : undefined,
    targetAudience:
      args.targetAudience !== undefined ? asOptionalString(args.targetAudience) : undefined,
    tone: args.tone !== undefined ? asOptionalString(args.tone) : undefined,
    websites: Array.isArray(args.websites) ? asStringArray(args.websites) : undefined,
    assetImage: args.assetImage !== undefined ? asOptionalString(args.assetImage) : undefined,
    assetCaption:
      args.assetCaption !== undefined ? asOptionalString(args.assetCaption) : undefined,
    primaryAssetId:
      args.primaryAssetId !== undefined ? asOptionalString(args.primaryAssetId) : undefined,
    aiGenerated: args.aiGenerated !== undefined ? asBoolean(args.aiGenerated) : undefined,
    sourcePrompt:
      args.sourcePrompt !== undefined ? asOptionalString(args.sourcePrompt) : undefined,
    updatedById: context.access.id,
  };

  const mergedForRules = {
    title: prepared.title ?? before.title,
    body: prepared.body !== undefined ? prepared.body : before.body,
    hook: prepared.hook !== undefined ? prepared.hook : before.hook,
    cta: prepared.cta !== undefined ? prepared.cta : before.cta,
    brand: prepared.brand !== undefined ? prepared.brand : before.brand,
    tone: prepared.tone !== undefined ? prepared.tone : before.tone,
    targetAudience:
      prepared.targetAudience !== undefined ? prepared.targetAudience : before.targetAudience,
    websites: prepared.websites !== undefined ? prepared.websites : before.websites,
    sport: prepared.sport !== undefined ? prepared.sport : before.sport,
    region: prepared.region !== undefined ? prepared.region : before.region,
    country: prepared.country !== undefined ? prepared.country : before.country,
    sourcePrompt:
      prepared.sourcePrompt !== undefined ? prepared.sourcePrompt : before.sourcePrompt,
  };

  const {
    data: brandAdjustedData,
    profile,
    warnings,
  } = await applyBrandRulesToContent(mergedForRules);

  const updated = await prisma.content.update({
    where: { id },
    data: {
      ...prepared,
      cta: brandAdjustedData.cta,
      tone: brandAdjustedData.tone,
      targetAudience: brandAdjustedData.targetAudience,
      websites: brandAdjustedData.websites,
      sport: brandAdjustedData.sport,
      region: brandAdjustedData.region,
      country: brandAdjustedData.country,
      brand: brandAdjustedData.brand,
    },
  });

  await createActionLog({
    userId: context.access.id,
    actionType: "update",
    targetType: "content",
    targetId: updated.id,
    summary: `AI updated content "${updated.title}"${profile ? ` using ${profile.brandName} rules` : ""}${warnings.length > 0 ? ` with ${warnings.length} brand warning${warnings.length === 1 ? "" : "s"}` : ""}`,
    beforeData: before,
    afterData: {
      ...updated,
      brandProfileApplied: profile?.brandName ?? null,
      brandWarnings: warnings,
    },
    source: "ai",
  });

  return {
    toolName: "update_content",
    summary: `Updated content "${updated.title}".`,
    payload: {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      contentType: updated.contentType,
    },
  };
}

async function listBlogsTool(args: Record<string, unknown>) {
  const status = asOptionalString(args.status);
  const sport = asOptionalString(args.sport);
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 25) : 10;

  const items = await prisma.blog.findMany({
    where: {
      status: status ? (status as BlogStatus) : undefined,
      sport: sport ?? undefined,
    },
    include: {
      featureAsset: {
        select: { id: true, title: true, fileUrl: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return {
    toolName: "list_blogs",
    summary: `Found ${items.length} blog record${items.length === 1 ? "" : "s"}.`,
    payload: {
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        brand: item.brand,
        category: item.category,
        sport: item.sport,
        featureAsset: item.featureAsset,
        updatedAt: item.updatedAt.toISOString(),
      })),
    },
  };
}

async function createBlogTool(args: Record<string, unknown>, context: ToolContext) {
  const sectionFields = Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => index + 1).flatMap((section) => [
      [`text${section}`, asOptionalString(args[`text${section}`])],
      [`image${section}`, asOptionalString(args[`image${section}`])],
      [`image${section}Caption`, asOptionalString(args[`image${section}Caption`])],
    ]),
  );

  const prepared = {
    title: asRequiredString(args.title, "title"),
    brand: asOptionalString(args.brand),
    postDate: asNullableDate(args.postDate),
    authorName: asOptionalString(args.authorName),
    authorImage: asOptionalString(args.authorImage),
    featureImage: asOptionalString(args.featureImage),
    featureAssetId: asOptionalString(args.featureAssetId),
    ...sectionFields,
    websites: asStringArray(args.websites),
    category: asOptionalString(args.category),
    tags: asStringArray(args.tags),
    authorBio: asOptionalString(args.authorBio),
    status: parseEnumValue(args.status, Object.values(BlogStatus), BlogStatus.draft),
    sport: asOptionalString(args.sport),
    region: asOptionalString(args.region),
    country: asOptionalString(args.country),
    sources: asStringArray(args.sources),
    aiGenerated: true,
    sourcePrompt: asOptionalString(args.sourcePrompt),
    createdById: context.access.id,
    updatedById: context.access.id,
  };

  const { data, profile, warnings } = await applyBrandRulesToBlog(prepared);
  const blog = await prisma.blog.create({ data });

  await createActionLog({
    userId: context.access.id,
    actionType: "create",
    targetType: "blog",
    targetId: blog.id,
    summary: `AI created blog "${blog.title}"${profile ? ` using ${profile.brandName} rules` : ""}${warnings.length > 0 ? ` with ${warnings.length} brand warning${warnings.length === 1 ? "" : "s"}` : ""}`,
    afterData: {
      ...blog,
      brandProfileApplied: profile?.brandName ?? null,
      brandWarnings: warnings,
    },
    source: "ai",
  });

  return {
    toolName: "create_blog",
    summary: `Created blog "${blog.title}" (${blog.id}).`,
    payload: {
      id: blog.id,
      title: blog.title,
      status: blog.status,
      category: blog.category,
    },
  };
}

async function updateBlogTool(args: Record<string, unknown>, context: ToolContext) {
  const id = asRequiredString(args.id, "id");
  const before = await prisma.blog.findUniqueOrThrow({ where: { id } });

  const dynamicSectionData = Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => index + 1).flatMap((section) => [
      [
        `text${section}`,
        Object.prototype.hasOwnProperty.call(args, `text${section}`)
          ? asOptionalString(args[`text${section}`])
          : undefined,
      ],
      [
        `image${section}`,
        Object.prototype.hasOwnProperty.call(args, `image${section}`)
          ? asOptionalString(args[`image${section}`])
          : undefined,
      ],
      [
        `image${section}Caption`,
        Object.prototype.hasOwnProperty.call(args, `image${section}Caption`)
          ? asOptionalString(args[`image${section}Caption`])
          : undefined,
      ],
    ]),
  );

  const prepared = {
    title: asOptionalString(args.title) ?? undefined,
    brand: args.brand !== undefined ? asOptionalString(args.brand) : undefined,
    postDate: args.postDate !== undefined ? asNullableDate(args.postDate) : undefined,
    authorName: args.authorName !== undefined ? asOptionalString(args.authorName) : undefined,
    authorImage: args.authorImage !== undefined ? asOptionalString(args.authorImage) : undefined,
    featureImage:
      args.featureImage !== undefined ? asOptionalString(args.featureImage) : undefined,
    featureAssetId:
      args.featureAssetId !== undefined ? asOptionalString(args.featureAssetId) : undefined,
    websites: Array.isArray(args.websites) ? asStringArray(args.websites) : undefined,
    category: args.category !== undefined ? asOptionalString(args.category) : undefined,
    tags: Array.isArray(args.tags) ? asStringArray(args.tags) : undefined,
    authorBio: args.authorBio !== undefined ? asOptionalString(args.authorBio) : undefined,
    status:
      args.status !== undefined
        ? parseEnumValue(args.status, Object.values(BlogStatus), before.status)
        : undefined,
    sport: args.sport !== undefined ? asOptionalString(args.sport) : undefined,
    region: args.region !== undefined ? asOptionalString(args.region) : undefined,
    country: args.country !== undefined ? asOptionalString(args.country) : undefined,
    sources: Array.isArray(args.sources) ? asStringArray(args.sources) : undefined,
    aiGenerated: args.aiGenerated !== undefined ? asBoolean(args.aiGenerated) : undefined,
    sourcePrompt:
      args.sourcePrompt !== undefined ? asOptionalString(args.sourcePrompt) : undefined,
    updatedById: context.access.id,
  };

  const mergedForRules = {
    title: prepared.title ?? before.title,
    brand: prepared.brand !== undefined ? prepared.brand : before.brand,
    websites: prepared.websites !== undefined ? prepared.websites : before.websites,
    sport: prepared.sport !== undefined ? prepared.sport : before.sport,
    region: prepared.region !== undefined ? prepared.region : before.region,
    country: prepared.country !== undefined ? prepared.country : before.country,
    sourcePrompt:
      prepared.sourcePrompt !== undefined ? prepared.sourcePrompt : before.sourcePrompt,
    text1:
      dynamicSectionData.text1 !== undefined ? (dynamicSectionData.text1 as string | null) : before.text1,
    text2:
      dynamicSectionData.text2 !== undefined ? (dynamicSectionData.text2 as string | null) : before.text2,
    text3:
      dynamicSectionData.text3 !== undefined ? (dynamicSectionData.text3 as string | null) : before.text3,
    text4:
      dynamicSectionData.text4 !== undefined ? (dynamicSectionData.text4 as string | null) : before.text4,
    text5:
      dynamicSectionData.text5 !== undefined ? (dynamicSectionData.text5 as string | null) : before.text5,
    text6:
      dynamicSectionData.text6 !== undefined ? (dynamicSectionData.text6 as string | null) : before.text6,
    text7:
      dynamicSectionData.text7 !== undefined ? (dynamicSectionData.text7 as string | null) : before.text7,
    text8:
      dynamicSectionData.text8 !== undefined ? (dynamicSectionData.text8 as string | null) : before.text8,
  };

  const { data: brandAdjustedData, profile, warnings } = await applyBrandRulesToBlog(mergedForRules);

  const blog = await prisma.blog.update({
    where: { id },
    data: {
      ...prepared,
      ...dynamicSectionData,
      brand: brandAdjustedData.brand,
      websites: brandAdjustedData.websites,
      sport: brandAdjustedData.sport,
      region: brandAdjustedData.region,
      country: brandAdjustedData.country,
    },
  });

  await createActionLog({
    userId: context.access.id,
    actionType: "update",
    targetType: "blog",
    targetId: blog.id,
    summary: `AI updated blog "${blog.title}"${profile ? ` using ${profile.brandName} rules` : ""}${warnings.length > 0 ? ` with ${warnings.length} brand warning${warnings.length === 1 ? "" : "s"}` : ""}`,
    beforeData: before,
    afterData: {
      ...blog,
      brandProfileApplied: profile?.brandName ?? null,
      brandWarnings: warnings,
    },
    source: "ai",
  });

  return {
    toolName: "update_blog",
    summary: `Updated blog "${blog.title}".`,
    payload: {
      id: blog.id,
      title: blog.title,
      status: blog.status,
      category: blog.category,
    },
  };
}

async function listScheduleEntriesTool(args: Record<string, unknown>) {
  const status = asOptionalString(args.status);
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 25) : 10;

  const items = await prisma.contentSchedule.findMany({
    where: {
      status: status ? (status as ScheduleStatus) : undefined,
    },
    include: {
      content: { select: { title: true } },
      blog: { select: { title: true } },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  return {
    toolName: "list_schedule_entries",
    summary: `Found ${items.length} schedule entr${items.length === 1 ? "y" : "ies"}.`,
    payload: {
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        title: item.content?.title ?? item.blog?.title ?? null,
        scheduledFor: item.scheduledFor.toISOString(),
        channel: item.channel,
        status: item.status,
        brand: item.brand,
      })),
    },
  };
}

async function createScheduleEntryTool(args: Record<string, unknown>, context: ToolContext) {
  const contentId = asOptionalString(args.contentId);
  const blogId = asOptionalString(args.blogId);

  if (!contentId && !blogId) {
    throw new Error("contentId or blogId is required.");
  }

  const schedule = await prisma.contentSchedule.create({
    data: {
      contentId,
      blogId,
      scheduledFor: asNullableDate(args.scheduledFor) ?? new Date(),
      channel: asOptionalString(args.channel),
      platformAccount: asOptionalString(args.platformAccount),
      status: parseEnumValue(args.status, Object.values(ScheduleStatus), ScheduleStatus.planned),
      campaignName: asOptionalString(args.campaignName),
      priority: asOptionalString(args.priority),
      notes: asOptionalString(args.notes),
      brand: asOptionalString(args.brand),
      sport: asOptionalString(args.sport),
      region: asOptionalString(args.region),
      country: asOptionalString(args.country),
      createdById: context.access.id,
    },
  });

  await createActionLog({
    userId: context.access.id,
    actionType: "create",
    targetType: "schedule",
    targetId: schedule.id,
    summary: "AI created schedule entry",
    afterData: schedule,
    source: "ai",
  });

  return {
    toolName: "create_schedule_entry",
    summary: `Created schedule entry ${schedule.id}.`,
    payload: {
      id: schedule.id,
      scheduledFor: schedule.scheduledFor.toISOString(),
      status: schedule.status,
    },
  };
}

async function updateScheduleEntryTool(args: Record<string, unknown>, context: ToolContext) {
  const id = asRequiredString(args.id, "id");
  const before = await prisma.contentSchedule.findUniqueOrThrow({ where: { id } });

  const schedule = await prisma.contentSchedule.update({
    where: { id },
    data: {
      contentId:
        Object.prototype.hasOwnProperty.call(args, "contentId")
          ? asOptionalString(args.contentId)
          : undefined,
      blogId:
        Object.prototype.hasOwnProperty.call(args, "blogId")
          ? asOptionalString(args.blogId)
          : undefined,
      scheduledFor:
        Object.prototype.hasOwnProperty.call(args, "scheduledFor")
          ? asNullableDate(args.scheduledFor) ?? undefined
          : undefined,
      channel:
        Object.prototype.hasOwnProperty.call(args, "channel")
          ? asOptionalString(args.channel)
          : undefined,
      platformAccount:
        Object.prototype.hasOwnProperty.call(args, "platformAccount")
          ? asOptionalString(args.platformAccount)
          : undefined,
      status:
        Object.prototype.hasOwnProperty.call(args, "status")
          ? parseEnumValue(args.status, Object.values(ScheduleStatus), before.status)
          : undefined,
      campaignName:
        Object.prototype.hasOwnProperty.call(args, "campaignName")
          ? asOptionalString(args.campaignName)
          : undefined,
      priority:
        Object.prototype.hasOwnProperty.call(args, "priority")
          ? asOptionalString(args.priority)
          : undefined,
      notes:
        Object.prototype.hasOwnProperty.call(args, "notes")
          ? asOptionalString(args.notes)
          : undefined,
      brand:
        Object.prototype.hasOwnProperty.call(args, "brand")
          ? asOptionalString(args.brand)
          : undefined,
      sport:
        Object.prototype.hasOwnProperty.call(args, "sport")
          ? asOptionalString(args.sport)
          : undefined,
      region:
        Object.prototype.hasOwnProperty.call(args, "region")
          ? asOptionalString(args.region)
          : undefined,
      country:
        Object.prototype.hasOwnProperty.call(args, "country")
          ? asOptionalString(args.country)
          : undefined,
    },
  });

  await createActionLog({
    userId: context.access.id,
    actionType: "update",
    targetType: "schedule",
    targetId: schedule.id,
    summary: "AI updated schedule entry",
    beforeData: before,
    afterData: schedule,
    source: "ai",
  });

  return {
    toolName: "update_schedule_entry",
    summary: `Updated schedule entry ${schedule.id}.`,
    payload: {
      id: schedule.id,
      scheduledFor: schedule.scheduledFor.toISOString(),
      status: schedule.status,
    },
  };
}

async function getDashboardSummaryTool() {
  const [contentCounts, blogCounts, upcomingSchedule, recentActions] = await Promise.all([
    prisma.content.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.blog.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.contentSchedule.findMany({
      orderBy: { scheduledFor: "asc" },
      take: 5,
      include: {
        content: { select: { title: true } },
        blog: { select: { title: true } },
      },
    }),
    prisma.contentActionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    toolName: "get_dashboard_summary",
    summary: "Retrieved dashboard summary.",
    payload: {
      contentCounts: contentCounts.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
      blogCounts: blogCounts.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
      upcomingSchedule: upcomingSchedule.map((item) => ({
        id: item.id,
        title: item.content?.title ?? item.blog?.title ?? null,
        scheduledFor: item.scheduledFor.toISOString(),
        status: item.status,
      })),
      recentActions: recentActions.map((item) => ({
        id: item.id,
        summary: item.summary,
        createdAt: item.createdAt.toISOString(),
        source: item.source,
      })),
    },
  };
}

async function listAssetsTool(args: Record<string, unknown>) {
  const brand = asOptionalString(args.brand);
  const campaignName = asOptionalString(args.campaignName);
  const sport = asOptionalString(args.sport);
  const region = asOptionalString(args.region);
  const country = asOptionalString(args.country);
  const search = asOptionalString(args.search);
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 25) : 12;

  const items = await prisma.asset.findMany({
    where: {
      brand: brand ?? undefined,
      campaignName: campaignName ?? undefined,
      sport: sport ?? undefined,
      region: region ?? undefined,
      country: country ?? undefined,
      OR: search
        ? [
            { title: { contains: search, mode: "insensitive" } },
            { altText: { contains: search, mode: "insensitive" } },
            { caption: { contains: search, mode: "insensitive" } },
            { tags: { has: search } },
          ]
        : undefined,
    },
    orderBy: [{ syncedAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });

  return {
    toolName: "list_assets",
    summary: `Found ${items.length} asset${items.length === 1 ? "" : "s"}.`,
    payload: {
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        source: item.source,
        fileUrl: item.fileUrl,
        thumbnailUrl: item.thumbnailUrl,
        mimeType: item.mimeType,
        width: item.width,
        height: item.height,
        brand: item.brand,
        campaignName: item.campaignName,
        sport: item.sport,
        region: item.region,
        country: item.country,
        tags: item.tags,
      })),
    },
  };
}

async function syncWordPressAssetsTool(context: ToolContext) {
  const { syncLatestWordPressMedia } = await import("@/lib/wordpress/media");
  const assets = await syncLatestWordPressMedia(50);

  await createActionLog({
    userId: context.access.id,
    actionType: "sync",
    targetType: "asset",
    targetId: "wordpress",
    summary: `AI synced ${assets.length} WordPress asset${assets.length === 1 ? "" : "s"}`,
    afterData: { count: assets.length },
    source: "ai",
  });

  return {
    toolName: "sync_wordpress_assets",
    summary: `Synced ${assets.length} WordPress asset${assets.length === 1 ? "" : "s"}.`,
    payload: {
      count: assets.length,
      items: assets.slice(0, 10).map((asset) => ({
        id: asset.id,
        title: asset.title,
        fileUrl: asset.fileUrl,
      })),
    },
  };
}

async function listBrandProfilesTool(args: Record<string, unknown>) {
  const brandName = asOptionalString(args.brandName);

  const items = await prisma.brandProfile.findMany({
    where: brandName
      ? {
          brandName: {
            contains: brandName,
            mode: "insensitive",
          },
        }
      : undefined,
    orderBy: { brandName: "asc" },
    take: 25,
  });

  return {
    toolName: "list_brand_profiles",
    summary: `Found ${items.length} brand profile${items.length === 1 ? "" : "s"}.`,
    payload: {
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        brandName: item.brandName,
        defaultTone: item.defaultTone,
        targetAudience: item.targetAudience,
        preferredWebsites: item.preferredWebsites,
        sports: item.sports,
        regions: item.regions,
        countries: item.countries,
        contentPillars: item.contentPillars,
        audiencePersonas: item.audiencePersonas,
        keyOffers: item.keyOffers,
        proofPoints: item.proofPoints,
        seoKeywords: item.seoKeywords,
        competitors: item.competitors,
        voiceExamples: item.voiceExamples,
        visualGuidelines: item.visualGuidelines,
        channelGuidelines: {
          instagram: item.instagramGuidelines,
          facebook: item.facebookGuidelines,
          linkedin: item.linkedinGuidelines,
          blog: item.blogGuidelines,
          email: item.emailGuidelines,
          ads: item.adGuidelines,
        },
        bannedPhrases: item.bannedPhrases,
        preferredCTAs: item.preferredCTAs,
        readiness: getBrandProfileReadiness(item),
      })),
    },
  };
}

async function getBrandProfileTool(args: Record<string, unknown>) {
  const id = asOptionalString(args.id);
  const brandName = asOptionalString(args.brandName);

  if (!id && !brandName) {
    throw new Error("id or brandName is required.");
  }

  const profile = await prisma.brandProfile.findFirstOrThrow({
    where: id
      ? { id }
      : {
          brandName: {
            equals: brandName ?? undefined,
            mode: "insensitive",
          },
        },
  });

  return {
    toolName: "get_brand_profile",
    summary: `Loaded brand profile "${profile.brandName}".`,
    payload: {
      ...profile,
      readiness: getBrandProfileReadiness(profile),
    },
  };
}

async function upsertBrandProfileTool(args: Record<string, unknown>, context: ToolContext) {
  const brandName = asRequiredString(args.brandName, "brandName");
  const before = await prisma.brandProfile.findUnique({
    where: { brandName },
  });

  const profile = await prisma.brandProfile.upsert({
    where: { brandName },
    create: {
      brandName,
      description: asOptionalString(args.description),
      positioning: asOptionalString(args.positioning),
      defaultTone: asOptionalString(args.defaultTone),
      targetAudience: asOptionalString(args.targetAudience),
      preferredWebsites: asStringArray(args.preferredWebsites),
      sports: asStringArray(args.sports),
      regions: asStringArray(args.regions),
      countries: asStringArray(args.countries),
      contentPillars: asStringArray(args.contentPillars),
      audiencePersonas: asStringArray(args.audiencePersonas),
      keyOffers: asStringArray(args.keyOffers),
      proofPoints: asStringArray(args.proofPoints),
      seoKeywords: asStringArray(args.seoKeywords),
      competitors: asStringArray(args.competitors),
      voiceExamples: asStringArray(args.voiceExamples),
      visualGuidelines: asOptionalString(args.visualGuidelines),
      instagramGuidelines: asOptionalString(args.instagramGuidelines),
      facebookGuidelines: asOptionalString(args.facebookGuidelines),
      linkedinGuidelines: asOptionalString(args.linkedinGuidelines),
      blogGuidelines: asOptionalString(args.blogGuidelines),
      emailGuidelines: asOptionalString(args.emailGuidelines),
      adGuidelines: asOptionalString(args.adGuidelines),
      bannedPhrases: asStringArray(args.bannedPhrases),
      preferredCTAs: asStringArray(args.preferredCTAs),
    },
    update: {
      description:
        args.description !== undefined ? asOptionalString(args.description) : undefined,
      positioning:
        args.positioning !== undefined ? asOptionalString(args.positioning) : undefined,
      defaultTone:
        args.defaultTone !== undefined ? asOptionalString(args.defaultTone) : undefined,
      targetAudience:
        args.targetAudience !== undefined ? asOptionalString(args.targetAudience) : undefined,
      preferredWebsites: Array.isArray(args.preferredWebsites)
        ? asStringArray(args.preferredWebsites)
        : undefined,
      sports: Array.isArray(args.sports) ? asStringArray(args.sports) : undefined,
      regions: Array.isArray(args.regions) ? asStringArray(args.regions) : undefined,
      countries: Array.isArray(args.countries) ? asStringArray(args.countries) : undefined,
      contentPillars: Array.isArray(args.contentPillars)
        ? asStringArray(args.contentPillars)
        : undefined,
      audiencePersonas: Array.isArray(args.audiencePersonas)
        ? asStringArray(args.audiencePersonas)
        : undefined,
      keyOffers: Array.isArray(args.keyOffers) ? asStringArray(args.keyOffers) : undefined,
      proofPoints: Array.isArray(args.proofPoints) ? asStringArray(args.proofPoints) : undefined,
      seoKeywords: Array.isArray(args.seoKeywords) ? asStringArray(args.seoKeywords) : undefined,
      competitors: Array.isArray(args.competitors) ? asStringArray(args.competitors) : undefined,
      voiceExamples: Array.isArray(args.voiceExamples) ? asStringArray(args.voiceExamples) : undefined,
      visualGuidelines:
        args.visualGuidelines !== undefined ? asOptionalString(args.visualGuidelines) : undefined,
      instagramGuidelines:
        args.instagramGuidelines !== undefined ? asOptionalString(args.instagramGuidelines) : undefined,
      facebookGuidelines:
        args.facebookGuidelines !== undefined ? asOptionalString(args.facebookGuidelines) : undefined,
      linkedinGuidelines:
        args.linkedinGuidelines !== undefined ? asOptionalString(args.linkedinGuidelines) : undefined,
      blogGuidelines:
        args.blogGuidelines !== undefined ? asOptionalString(args.blogGuidelines) : undefined,
      emailGuidelines:
        args.emailGuidelines !== undefined ? asOptionalString(args.emailGuidelines) : undefined,
      adGuidelines:
        args.adGuidelines !== undefined ? asOptionalString(args.adGuidelines) : undefined,
      bannedPhrases: Array.isArray(args.bannedPhrases)
        ? asStringArray(args.bannedPhrases)
        : undefined,
      preferredCTAs: Array.isArray(args.preferredCTAs)
        ? asStringArray(args.preferredCTAs)
        : undefined,
    },
  });

  await createActionLog({
    userId: context.access.id,
    actionType: before ? "update" : "create",
    targetType: "brand_profile",
    targetId: profile.id,
    summary: `AI ${before ? "updated" : "created"} brand profile "${profile.brandName}"`,
    beforeData: before,
    afterData: profile,
    source: "ai",
  });

  return {
    toolName: "upsert_brand_profile",
    summary: `${before ? "Updated" : "Created"} brand profile "${profile.brandName}".`,
    payload: {
      ...profile,
      readiness: getBrandProfileReadiness(profile),
    },
  };
}

async function listCampaignsTool(args: Record<string, unknown>) {
  const response = await listCampaigns({
    status: asOptionalString(args.status) as CampaignStatus | undefined,
    startDate: asOptionalString(args.startDate) ?? undefined,
    endDate: asOptionalString(args.endDate) ?? undefined,
    page: typeof args.page === "number" ? args.page : undefined,
    limit: typeof args.limit === "number" ? args.limit : 20,
  });

  return {
    toolName: "list_campaigns",
    summary: `Found ${response.data.length} campaign${response.data.length === 1 ? "" : "s"}.`,
    payload: {
      count: response.data.length,
      items: response.data.map((campaign) => ({
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        campaign_status: campaign.campaign_status,
        campaign_type: campaign.campaign_type,
        brand: campaign.brand,
        country: campaign.country,
        region: campaign.region,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
      })),
    },
  };
}

async function getCampaignTool(args: Record<string, unknown>) {
  const campaignId = asRequiredString(args.campaign_id, "campaign_id");
  const campaign = await getCampaign(campaignId);

  return {
    toolName: "get_campaign",
    summary: `Loaded campaign "${campaign.campaign_name}".`,
    payload: campaign,
  };
}

async function upsertCampaignTool(args: Record<string, unknown>, context: ToolContext) {
  const linkedAssetId = asOptionalString(args.linkedAssetId);
  const payload = {
    campaign_id: asOptionalString(args.campaign_id) ?? undefined,
    campaign_name: asRequiredString(args.campaign_name, "campaign_name"),
    brand: asStringArray(args.brand),
    start_date: asOptionalString(args.start_date),
    end_date: asOptionalString(args.end_date),
    campaign_description: asOptionalString(args.campaign_description),
    featured_image_link: asOptionalString(args.featured_image_link),
    campaign_status:
      parseEnumValue(
        args.campaign_status,
        campaignStatuses,
        "draft",
      ) as CampaignStatus,
    campaign_type:
      parseEnumValue(
        args.campaign_type,
        campaignTypes,
        campaignTypes[0],
      ) ?? asOptionalString(args.campaign_type),
    country: asOptionalString(args.country),
    region: asOptionalString(args.region),
    category: asOptionalString(args.category),
    partner_id: asOptionalString(args.partner_id),
  };

  const campaign = await upsertCampaign(payload);

  await prisma.campaignAsset.deleteMany({
    where: { campaignId: campaign.campaign_id },
  });

  if (linkedAssetId) {
    await prisma.campaignAsset.create({
      data: {
        campaignId: campaign.campaign_id,
        assetId: linkedAssetId,
        role: "primary",
      },
    });
  }

  await createActionLog({
    userId: context.access.id,
    actionType: payload.campaign_id ? "update" : "create",
    targetType: "campaign",
    targetId: campaign.campaign_id,
    summary: `AI ${payload.campaign_id ? "updated" : "created"} campaign "${campaign.campaign_name}"`,
    afterData: campaign,
    source: "ai",
  });

  return {
    toolName: "upsert_campaign",
    summary: `${payload.campaign_id ? "Updated" : "Created"} campaign "${campaign.campaign_name}".`,
    payload: campaign,
  };
}

async function deleteCampaignTool(args: Record<string, unknown>, context: ToolContext) {
  const campaignId = asRequiredString(args.campaign_id, "campaign_id");
  const campaign = await getCampaign(campaignId);
  const result = await deleteCampaign(campaignId);

  await createActionLog({
    userId: context.access.id,
    actionType: "delete",
    targetType: "campaign",
    targetId: campaignId,
    summary: `AI deleted campaign "${campaign.campaign_name}"`,
    afterData: result,
    source: "ai",
  });

  return {
    toolName: "delete_campaign",
    summary: `Deleted campaign "${campaign.campaign_name}".`,
    payload: result,
  };
}

async function listConnectedAccountsTool(args: Record<string, unknown>) {
  const platformInput = asOptionalString(args.platform);
  const statusInput = asOptionalString(args.status);
  const platform = platformInput
    ? parseEnumValue(platformInput, Object.values(SocialPlatform), SocialPlatform.facebook)
    : undefined;
  const status = statusInput
    ? parseEnumValue(
        statusInput,
        Object.values(ConnectedAccountStatus),
        ConnectedAccountStatus.pending_setup,
      )
    : undefined;
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 25) : 12;

  const items = await prisma.connectedAccount.findMany({
    where: {
      platform: platform ?? undefined,
      status: status ?? undefined,
    },
    include: {
      brandProfile: {
        select: { brandName: true },
      },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });

  return {
    toolName: "list_connected_accounts",
    summary: `Found ${items.length} connected account${items.length === 1 ? "" : "s"}.`,
    payload: {
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        platform: item.platform,
        status: item.status,
        accountName: item.accountName,
        accountHandle: item.accountHandle,
        brand: item.brandProfile?.brandName ?? item.brandName,
        lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
        lastSyncStatus: item.lastSyncStatus,
      })),
    },
  };
}

async function listPublishedPostsTool(args: Record<string, unknown>) {
  const platformInput = asOptionalString(args.platform);
  const statusInput = asOptionalString(args.status);
  const platform = platformInput
    ? parseEnumValue(platformInput, Object.values(SocialPlatform), SocialPlatform.instagram)
    : undefined;
  const status = statusInput
    ? parseEnumValue(statusInput, Object.values(PublishedPostStatus), PublishedPostStatus.imported)
    : undefined;
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 25) : 12;

  const items = await prisma.publishedPost.findMany({
    where: {
      platform: platform ?? undefined,
      status: status ?? undefined,
    },
    include: {
      connectedAccount: {
        select: { accountName: true },
      },
      content: {
        select: { title: true, brand: true },
      },
      blog: {
        select: { title: true, brand: true },
      },
      analyticsSnapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return {
    toolName: "list_published_posts",
    summary: `Found ${items.length} published post record${items.length === 1 ? "" : "s"}.`,
    payload: {
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        platform: item.platform,
        status: item.status,
        title: item.titleSnapshot ?? item.content?.title ?? item.blog?.title ?? null,
        brand: item.content?.brand ?? item.blog?.brand ?? null,
        accountName: item.connectedAccount?.accountName ?? item.platformAccountName,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        latestAnalytics: item.analyticsSnapshots[0]
          ? {
              capturedAt: item.analyticsSnapshots[0].capturedAt.toISOString(),
              impressions: item.analyticsSnapshots[0].impressions,
              engagements: item.analyticsSnapshots[0].engagements,
              engagementRate: item.analyticsSnapshots[0].engagementRate,
              clicks: item.analyticsSnapshots[0].clicks,
            }
          : null,
      })),
    },
  };
}

async function getTopPerformingPostsTool(args: Record<string, unknown>) {
  const platformInput = asOptionalString(args.platform);
  const platform = platformInput
    ? parseEnumValue(platformInput, Object.values(SocialPlatform), SocialPlatform.instagram)
    : undefined;
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 10) : 5;

  const items = await prisma.publishedPost.findMany({
    where: {
      platform: platform ?? undefined,
    },
    include: {
      connectedAccount: {
        select: { accountName: true },
      },
      content: {
        select: { title: true, brand: true },
      },
      blog: {
        select: { title: true, brand: true },
      },
      analyticsSnapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
    },
    take: 100,
  });

  const ranked = items
    .map((item) => ({
      item,
      latest: item.analyticsSnapshots[0] ?? null,
    }))
    .filter((entry) => entry.latest)
    .sort((a, b) => (b.latest?.engagementRate ?? -1) - (a.latest?.engagementRate ?? -1))
    .slice(0, limit);

  return {
    toolName: "get_top_performing_posts",
    summary: `Found ${ranked.length} top-performing post${ranked.length === 1 ? "" : "s"}.`,
    payload: {
      count: ranked.length,
      items: ranked.map(({ item, latest }) => ({
        id: item.id,
        platform: item.platform,
        title: item.titleSnapshot ?? item.content?.title ?? item.blog?.title ?? null,
        brand: item.content?.brand ?? item.blog?.brand ?? null,
        accountName: item.connectedAccount?.accountName ?? item.platformAccountName,
        engagementRate: latest?.engagementRate ?? null,
        engagements: latest?.engagements ?? null,
        impressions: latest?.impressions ?? null,
        clicks: latest?.clicks ?? null,
      })),
    },
  };
}

async function listAutomationsTool(args: Record<string, unknown>) {
  const status = asOptionalString(args.status);
  const type = asOptionalString(args.type);
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 25) : 10;

  const items = await prisma.automationWorkflow.findMany({
    where: {
      status: status ? (status as AutomationStatus) : undefined,
      type: type ? (type as AutomationType) : undefined,
    },
    include: {
      brandProfile: {
        select: { brandName: true },
      },
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ status: "asc" }, { nextRunAt: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });

  return {
    toolName: "list_automations",
    summary: `Found ${items.length} automation workflow${items.length === 1 ? "" : "s"}.`,
    payload: {
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        status: item.status,
        frequency: item.frequency,
        brand: item.brandProfile?.brandName ?? item.brandName,
        nextRunAt: item.nextRunAt?.toISOString() ?? null,
        latestRun: item.runs[0]
          ? {
              status: item.runs[0].status,
              summary: item.runs[0].summary,
              startedAt: item.runs[0].startedAt.toISOString(),
            }
          : null,
      })),
    },
  };
}

async function getAutomationHealthTool() {
  const summary = await getAutomationHealthSummary();

  return {
    toolName: "get_automation_health",
    summary: "Loaded automation health summary.",
    payload: {
      total: summary.total,
      active: summary.active,
      dueNow: summary.dueNow,
      failedRecently: summary.failedRecently,
      nextDue: summary.nextDue
        ? {
            id: summary.nextDue.id,
            name: summary.nextDue.name,
            nextRunAt: summary.nextDue.nextRunAt?.toISOString() ?? null,
          }
        : null,
    },
  };
}

async function runAutomationTool(args: Record<string, unknown>, context: ToolContext) {
  const id = asOptionalString(args.id);
  const runDue = asBoolean(args.runDue);

  if (runDue) {
    const result = await runDueAutomations();

    await createActionLog({
      userId: context.access.id,
      actionType: "run",
      targetType: "automation_runner",
      targetId: "due",
      summary: `AI triggered due automation runner (${result.results.length} workflow${result.results.length === 1 ? "" : "s"} checked)`,
      afterData: result,
      source: "ai",
    });

    return {
      toolName: "run_automation",
      summary: `Ran due automation check across ${result.checked} workflow${result.checked === 1 ? "" : "s"}.`,
      payload: result,
    };
  }

  if (!id) {
    throw new Error("id is required unless runDue is true.");
  }

  const workflow = await prisma.automationWorkflow.findUniqueOrThrow({
    where: { id },
  });

  if (workflow.type === AutomationType.weekly_social_content) {
    const output = await runWeeklySocialAutomation({
      workflow,
      triggeredBy: context.access,
    });

    return {
      toolName: "run_automation",
      summary: `Ran automation "${workflow.name}" and created ${output.createdContent.length} draft${output.createdContent.length === 1 ? "" : "s"}.`,
      payload: {
        workflowId: workflow.id,
        workflowName: workflow.name,
        createdCount: output.createdContent.length,
        contentIds: output.createdContent.map((item) => item.id),
        titles: output.createdContent.map((item) => item.title),
      },
    };
  }

  if (workflow.type === AutomationType.blog_post_generation) {
    const output = await runBlogPostAutomation({
      workflow,
      triggeredBy: context.access,
    });

    return {
      toolName: "run_automation",
      summary: `Ran automation "${workflow.name}" and created ${output.createdBlogs.length} blog draft${output.createdBlogs.length === 1 ? "" : "s"}.`,
      payload: {
        workflowId: workflow.id,
        workflowName: workflow.name,
        createdCount: output.createdBlogs.length,
        blogIds: output.createdBlogs.map((item) => item.id),
        titles: output.createdBlogs.map((item) => item.title),
      },
    };
  }

  throw new Error("Unsupported automation type.");
}

async function listContentPlansTool(args: Record<string, unknown>) {
  const status = asOptionalString(args.status);
  const brand = asOptionalString(args.brand);
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 25) : 10;

  const plans = await prisma.contentPlan.findMany({
    where: {
      status: status ? (status as ContentPlanStatus) : undefined,
      brand: brand ?? undefined,
    },
    include: {
      _count: { select: { items: true } },
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 8,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return {
    toolName: "list_content_plans",
    summary: `Found ${plans.length} content plan${plans.length === 1 ? "" : "s"}.`,
    payload: {
      count: plans.length,
      plans: plans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        goal: plan.goal,
        status: plan.status,
        brand: plan.brand,
        campaignName: plan.campaignName,
        startDate: plan.startDate?.toISOString() ?? null,
        endDate: plan.endDate?.toISOString() ?? null,
        itemCount: plan._count.items,
        items: plan.items.map((item) => ({
          id: item.id,
          title: item.title,
          itemType: item.itemType,
          status: item.status,
          channel: item.channel,
          scheduledFor: item.scheduledFor?.toISOString() ?? null,
        })),
      })),
    },
  };
}

async function createContentPlanTool(args: Record<string, unknown>, context: ToolContext) {
  const plan = await prisma.contentPlan.create({
    data: {
      title: asRequiredString(args.title, "title"),
      description: asOptionalString(args.description),
      goal: asOptionalString(args.goal),
      status: parseEnumValue(args.status, Object.values(ContentPlanStatus), ContentPlanStatus.draft),
      startDate: asNullableDate(args.startDate),
      endDate: asNullableDate(args.endDate),
      brand: asOptionalString(args.brand),
      campaignName: asOptionalString(args.campaignName),
      sourcePrompt: asOptionalString(args.sourcePrompt),
      createdById: context.access.id,
      updatedById: context.access.id,
    },
  });

  await createActionLog({
    userId: context.access.id,
    actionType: "create",
    targetType: "content_plan",
    targetId: plan.id,
    summary: `AI created content plan "${plan.title}"`,
    afterData: plan,
    source: "ai",
  });

  return {
    toolName: "create_content_plan",
    summary: `Created content plan "${plan.title}" (${plan.id}).`,
    payload: {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      brand: plan.brand,
      campaignName: plan.campaignName,
    },
  };
}

async function addContentPlanItemTool(args: Record<string, unknown>, context: ToolContext) {
  const planId = asRequiredString(args.planId, "planId");
  const plan = await prisma.contentPlan.findUniqueOrThrow({
    where: { id: planId },
    include: { _count: { select: { items: true } } },
  });

  const item = await prisma.contentPlanItem.create({
    data: {
      planId,
      itemType: parseEnumValue(
        args.itemType,
        Object.values(ContentPlanItemType),
        ContentPlanItemType.content,
      ),
      status: parseEnumValue(
        args.status,
        Object.values(ContentPlanItemStatus),
        ContentPlanItemStatus.planned,
      ),
      title: asRequiredString(args.title, "title"),
      brief: asOptionalString(args.brief),
      channel: asOptionalString(args.channel),
      scheduledFor: asNullableDate(args.scheduledFor),
      brand: asOptionalString(args.brand) ?? plan.brand,
      sport: asOptionalString(args.sport),
      region: asOptionalString(args.region),
      country: asOptionalString(args.country),
      campaignName: asOptionalString(args.campaignName) ?? plan.campaignName,
      contentId: asOptionalString(args.contentId),
      blogId: asOptionalString(args.blogId),
      scheduleId: asOptionalString(args.scheduleId),
      assetRequest: asOptionalString(args.assetRequest),
      sortOrder: plan._count.items,
    },
  });

  await createActionLog({
    userId: context.access.id,
    actionType: "create",
    targetType: "content_plan_item",
    targetId: item.id,
    summary: `AI added "${item.title}" to content plan "${plan.title}"`,
    afterData: item,
    source: "ai",
  });

  return {
    toolName: "add_content_plan_item",
    summary: `Added "${item.title}" to plan "${plan.title}".`,
    payload: {
      id: item.id,
      planId: item.planId,
      title: item.title,
      itemType: item.itemType,
      status: item.status,
    },
  };
}

async function reviewQualityTool(args: Record<string, unknown>, context: ToolContext) {
  const targetType = parseEnumValue(
    args.targetType,
    Object.values(QualityReviewTargetType),
    QualityReviewTargetType.content,
  );
  const targetId = asRequiredString(args.targetId, "targetId");

  const review = await runQualityReview({
    targetType,
    targetId,
    createdById: context.access.id,
    source: "ai",
  });

  return {
    toolName: "review_quality",
    summary: `Quality review scored ${review.overallScore}/100 with verdict ${review.verdict}.`,
    payload: {
      id: review.id,
      targetType: review.targetType,
      targetId,
      overallScore: review.overallScore,
      brandScore: review.brandScore,
      audienceScore: review.audienceScore,
      clarityScore: review.clarityScore,
      channelScore: review.channelScore,
      conversionScore: review.conversionScore,
      riskScore: review.riskScore,
      verdict: review.verdict,
      summary: review.summary,
      strengths: review.strengths,
      issues: review.issues,
      recommendations: review.recommendations,
      rewrittenHook: review.rewrittenHook,
      rewrittenCTA: review.rewrittenCTA,
    },
  };
}

const toolHandlers: Record<string, ToolHandler> = {
  list_content: async (args) => listContentTool(args),
  create_content: createContentTool,
  update_content: updateContentTool,
  list_blogs: async (args) => listBlogsTool(args),
  create_blog: createBlogTool,
  update_blog: updateBlogTool,
  list_schedule_entries: async (args) => listScheduleEntriesTool(args),
  create_schedule_entry: createScheduleEntryTool,
  update_schedule_entry: updateScheduleEntryTool,
  get_dashboard_summary: async () => getDashboardSummaryTool(),
  list_assets: async (args) => listAssetsTool(args),
  sync_wordpress_assets: async (_args, context) => syncWordPressAssetsTool(context),
  list_brand_profiles: async (args) => listBrandProfilesTool(args),
  get_brand_profile: async (args) => getBrandProfileTool(args),
  upsert_brand_profile: upsertBrandProfileTool,
  list_campaigns: async (args) => listCampaignsTool(args),
  get_campaign: async (args) => getCampaignTool(args),
  upsert_campaign: upsertCampaignTool,
  delete_campaign: deleteCampaignTool,
  list_connected_accounts: async (args) => listConnectedAccountsTool(args),
  list_published_posts: async (args) => listPublishedPostsTool(args),
  get_top_performing_posts: async (args) => getTopPerformingPostsTool(args),
  list_automations: async (args) => listAutomationsTool(args),
  get_automation_health: async () => getAutomationHealthTool(),
  run_automation: runAutomationTool,
  list_content_plans: async (args) => listContentPlansTool(args),
  create_content_plan: createContentPlanTool,
  add_content_plan_item: addContentPlanItemTool,
  review_quality: reviewQualityTool,
};

export const contentOpsTools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_content",
      description: "List content records with optional filters for status, content type, and brand.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          contentType: { type: "string" },
          brand: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_content",
      description: "Create a new short-form content record.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          hook: { type: "string" },
          cta: { type: "string" },
          contentType: { type: "string", enum: Object.values(ContentType) },
          platform: { type: "string" },
          status: { type: "string", enum: Object.values(ContentStatus) },
          campaignName: { type: "string" },
          brand: { type: "string" },
          sport: { type: "string" },
          region: { type: "string" },
          country: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          targetAudience: { type: "string" },
          tone: { type: "string" },
          websites: { type: "array", items: { type: "string" } },
          assetImage: { type: "string" },
          assetCaption: { type: "string" },
          primaryAssetId: { type: "string" },
          sourcePrompt: { type: "string" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_content",
      description: "Update an existing content record by id. Include only fields that should change.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          hook: { type: "string" },
          cta: { type: "string" },
          contentType: { type: "string", enum: Object.values(ContentType) },
          platform: { type: "string" },
          status: { type: "string", enum: Object.values(ContentStatus) },
          campaignName: { type: "string" },
          brand: { type: "string" },
          sport: { type: "string" },
          region: { type: "string" },
          country: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          targetAudience: { type: "string" },
          tone: { type: "string" },
          websites: { type: "array", items: { type: "string" } },
          assetImage: { type: "string" },
          assetCaption: { type: "string" },
          primaryAssetId: { type: "string" },
          aiGenerated: { type: "boolean" },
          sourcePrompt: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_blogs",
      description: "List blog records with optional filters for status and sport.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          sport: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_blog",
      description: "Create a structured blog/article record with up to eight text/image sections.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          postDate: { type: "string" },
          authorName: { type: "string" },
          authorImage: { type: "string" },
          featureImage: { type: "string" },
          featureAssetId: { type: "string" },
          text1: { type: "string" },
          image1: { type: "string" },
          image1Caption: { type: "string" },
          text2: { type: "string" },
          image2: { type: "string" },
          image2Caption: { type: "string" },
          text3: { type: "string" },
          image3: { type: "string" },
          image3Caption: { type: "string" },
          text4: { type: "string" },
          image4: { type: "string" },
          image4Caption: { type: "string" },
          text5: { type: "string" },
          image5: { type: "string" },
          image5Caption: { type: "string" },
          text6: { type: "string" },
          image6: { type: "string" },
          image6Caption: { type: "string" },
          text7: { type: "string" },
          image7: { type: "string" },
          image7Caption: { type: "string" },
          text8: { type: "string" },
          image8: { type: "string" },
          image8Caption: { type: "string" },
          websites: { type: "array", items: { type: "string" } },
          category: { type: "string" },
          brand: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          authorBio: { type: "string" },
          status: { type: "string", enum: Object.values(BlogStatus) },
          sport: { type: "string" },
          region: { type: "string" },
          country: { type: "string" },
          sources: { type: "array", items: { type: "string" } },
          sourcePrompt: { type: "string" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_blog",
      description: "Update a structured blog record by id. Include only the fields that should change.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          postDate: { type: "string" },
          authorName: { type: "string" },
          authorImage: { type: "string" },
          featureImage: { type: "string" },
          featureAssetId: { type: "string" },
          text1: { type: "string" },
          image1: { type: "string" },
          image1Caption: { type: "string" },
          text2: { type: "string" },
          image2: { type: "string" },
          image2Caption: { type: "string" },
          text3: { type: "string" },
          image3: { type: "string" },
          image3Caption: { type: "string" },
          text4: { type: "string" },
          image4: { type: "string" },
          image4Caption: { type: "string" },
          text5: { type: "string" },
          image5: { type: "string" },
          image5Caption: { type: "string" },
          text6: { type: "string" },
          image6: { type: "string" },
          image6Caption: { type: "string" },
          text7: { type: "string" },
          image7: { type: "string" },
          image7Caption: { type: "string" },
          text8: { type: "string" },
          image8: { type: "string" },
          image8Caption: { type: "string" },
          websites: { type: "array", items: { type: "string" } },
          category: { type: "string" },
          brand: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          authorBio: { type: "string" },
          status: { type: "string", enum: Object.values(BlogStatus) },
          sport: { type: "string" },
          region: { type: "string" },
          country: { type: "string" },
          sources: { type: "array", items: { type: "string" } },
          aiGenerated: { type: "boolean" },
          sourcePrompt: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_schedule_entries",
      description: "List schedule entries with optional status filtering.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: Object.values(ScheduleStatus) },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_schedule_entry",
      description: "Create a new schedule entry linked to content or a blog.",
      parameters: {
        type: "object",
        properties: {
          contentId: { type: "string" },
          blogId: { type: "string" },
          scheduledFor: { type: "string" },
          channel: { type: "string" },
          platformAccount: { type: "string" },
          status: { type: "string", enum: Object.values(ScheduleStatus) },
          campaignName: { type: "string" },
          priority: { type: "string" },
          notes: { type: "string" },
          brand: { type: "string" },
          sport: { type: "string" },
          region: { type: "string" },
          country: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_schedule_entry",
      description: "Update an existing schedule entry by id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          contentId: { type: "string" },
          blogId: { type: "string" },
          scheduledFor: { type: "string" },
          channel: { type: "string" },
          platformAccount: { type: "string" },
          status: { type: "string", enum: Object.values(ScheduleStatus) },
          campaignName: { type: "string" },
          priority: { type: "string" },
          notes: { type: "string" },
          brand: { type: "string" },
          sport: { type: "string" },
          region: { type: "string" },
          country: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description: "Get counts and recent activity for the editorial workspace dashboard.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_assets",
      description: "List synced media assets from the internal asset catalog with optional filters.",
      parameters: {
        type: "object",
        properties: {
          brand: { type: "string" },
          campaignName: { type: "string" },
          sport: { type: "string" },
          region: { type: "string" },
          country: { type: "string" },
          search: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sync_wordpress_assets",
      description: "Sync the latest public WordPress media items into the internal asset catalog.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_brand_profiles",
      description: "List saved brand profiles and editorial rules.",
      parameters: {
        type: "object",
        properties: {
          brandName: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_brand_profile",
      description: "Get a specific brand profile by id or brand name.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          brandName: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upsert_brand_profile",
      description: "Create or update a brand profile used for editorial and AI guidance.",
      parameters: {
        type: "object",
        properties: {
          brandName: { type: "string" },
          description: { type: "string" },
          positioning: { type: "string" },
          defaultTone: { type: "string" },
          targetAudience: { type: "string" },
          preferredWebsites: { type: "array", items: { type: "string" } },
          sports: { type: "array", items: { type: "string" } },
          regions: { type: "array", items: { type: "string" } },
          countries: { type: "array", items: { type: "string" } },
          contentPillars: { type: "array", items: { type: "string" } },
          audiencePersonas: { type: "array", items: { type: "string" } },
          keyOffers: { type: "array", items: { type: "string" } },
          proofPoints: { type: "array", items: { type: "string" } },
          seoKeywords: { type: "array", items: { type: "string" } },
          competitors: { type: "array", items: { type: "string" } },
          voiceExamples: { type: "array", items: { type: "string" } },
          visualGuidelines: { type: "string" },
          instagramGuidelines: { type: "string" },
          facebookGuidelines: { type: "string" },
          linkedinGuidelines: { type: "string" },
          blogGuidelines: { type: "string" },
          emailGuidelines: { type: "string" },
          adGuidelines: { type: "string" },
          bannedPhrases: { type: "array", items: { type: "string" } },
          preferredCTAs: { type: "array", items: { type: "string" } },
        },
        required: ["brandName"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_campaigns",
      description: "List campaigns from the external TechSport campaigns API.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: campaignStatuses },
          startDate: { type: "string" },
          endDate: { type: "string" },
          page: { type: "number" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_campaign",
      description: "Get a specific campaign by campaign_id from the external campaigns API.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
        },
        required: ["campaign_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upsert_campaign",
      description: "Create or update a campaign in the external campaigns API.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          campaign_name: { type: "string" },
          brand: { type: "array", items: { type: "string" } },
          start_date: { type: "string" },
          end_date: { type: "string" },
          campaign_description: { type: "string" },
          featured_image_link: { type: "string" },
          campaign_status: { type: "string", enum: campaignStatuses },
          campaign_type: { type: "string", enum: campaignTypes },
          country: { type: "string" },
          region: { type: "string" },
          category: { type: "string" },
          partner_id: { type: "string" },
          linkedAssetId: { type: "string" },
        },
        required: ["campaign_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_campaign",
      description: "Delete a campaign by campaign_id in the external campaigns API.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
        },
        required: ["campaign_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_connected_accounts",
      description: "List connected or prepared social accounts available for publishing and analytics sync.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string" },
          status: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_published_posts",
      description: "List imported or synced published post records with latest analytics snapshots when available.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string" },
          status: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_performing_posts",
      description: "Return the highest-performing published posts ranked by latest engagement rate.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_automations",
      description: "List saved automation workflows with optional filtering by status or type.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: Object.values(AutomationStatus) },
          type: { type: "string", enum: Object.values(AutomationType) },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_automation_health",
      description: "Get automation health counts including due workflows, recent failures, and next scheduled run.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_automation",
      description: "Run a specific automation workflow by id, or run all due automations when runDue is true.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          runDue: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_content_plans",
      description: "List saved content plans with their first planned items.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: Object.values(ContentPlanStatus) },
          brand: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_content_plan",
      description: "Create a saved content plan that can hold briefs, schedule targets, asset requests, and automation work.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          goal: { type: "string" },
          status: { type: "string", enum: Object.values(ContentPlanStatus) },
          startDate: { type: "string" },
          endDate: { type: "string" },
          brand: { type: "string" },
          campaignName: { type: "string" },
          sourcePrompt: { type: "string" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_content_plan_item",
      description: "Add one planned content, blog, schedule, asset request, or automation item to an existing content plan.",
      parameters: {
        type: "object",
        properties: {
          planId: { type: "string" },
          itemType: { type: "string", enum: Object.values(ContentPlanItemType) },
          status: { type: "string", enum: Object.values(ContentPlanItemStatus) },
          title: { type: "string" },
          brief: { type: "string" },
          channel: { type: "string" },
          scheduledFor: { type: "string" },
          brand: { type: "string" },
          sport: { type: "string" },
          region: { type: "string" },
          country: { type: "string" },
          campaignName: { type: "string" },
          contentId: { type: "string" },
          blogId: { type: "string" },
          scheduleId: { type: "string" },
          assetRequest: { type: "string" },
        },
        required: ["planId", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "review_quality",
      description: "Run and save a strict AI editorial quality review for a content record, blog, or content plan item.",
      parameters: {
        type: "object",
        properties: {
          targetType: { type: "string", enum: Object.values(QualityReviewTargetType) },
          targetId: { type: "string" },
        },
        required: ["targetType", "targetId"],
        additionalProperties: false,
      },
    },
  },
];

export async function executeContentOpsTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
) {
  const handler = toolHandlers[name];

  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return handler(args, context);
}
