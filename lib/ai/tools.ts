Warning: truncated output (original token count: 31833)
Total output lines: 3524

import { runwayStartOperations } from "@/lib/mcp/runway-start-operation";
import { videoTestOperations } from "@/lib/mcp/video-test-operations";
import { videoApprovalOperations } from "@/lib/mcp/video-approval-operations";
import { mediaRecoveryOperations } from "@/lib/mcp/media-recovery-operations";
import { setPlanMediaBudget } from "@/lib/media/credit-budget";
import { brandKitOperations } from "@/lib/mcp/brand-kit-operations";
import { validate as validateMcpInput } from "@/lib/mcp/engine";
import { reconcilePublishedSchedule, scheduleHistoryTitle } from "@/lib/social/history-reconciliation";
import { publishedPostBrand, hasEngagementRate, hasPerformanceMetrics } from "@/lib/social/reporting";
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
import { createEditorialComment, resolveEditorialComment } from "@/lib/editorial/record-history";
import { syncTsadbImages } from "@/lib/assets/tsadb-images";
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
import { applyContentQualityRecommendations } from "@/lib/quality/apply-recommendations";
import { runQualityReview } from "@/lib/quality/editorial-review";
import { getQualityCommandSummary } from "@/lib/quality/summary";
import { promoteContentPlanItem, type PlanPromotionTarget } from "@/lib/plans/promotion";
import { generateAiContentPlan } from "@/lib/planner/ai-plan-builder";
import { generateVideoBrief } from "@/lib/planner/video-brief-builder";
import { updateVideoBrief } from "@/lib/planner/video-brief-editor";
import { queueVideoGeneration } from "@/lib/media/generation-jobs";
import { generateContentVariants, parseVariantPlatforms } from "@/lib/content-variants/generate";
import { runDueSocialSync } from "@/lib/social/sync-runner";
import { getMetaPublishReadiness, publishScheduleToMeta } from "@/lib/social/meta-publish";
import { getUnifiedProductionStatus } from "@/lib/production/status";

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
      publishedPosts: { select: { titleSnapshot: true }, orderBy: { publishedAt: "desc" } },
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
        title: scheduleHistoryTitle(item),
        scheduledFor: item.scheduledFor.toISOString(),
        channel: item.channel,
        status: item.status,
        brand: item.brand,
      })),
    },
  };
}

async function getMetaPublishingReadinessTool(args: Record<string, unknown>) {
  const brand = asOptionalString(args.brand)?.toLowerCase();
  const queue = asOptionalString(args.queue) ?? "all";
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 50) : 20;
  const [schedules, accounts] = await Promise.all([
    prisma.contentSchedule.findMany({
      where: { status: { notIn: [ScheduleStatus.cancelled, ScheduleStatus.missed] } },
      include: {
        content: {
          include: {
            primaryAsset: { select: { fileUrl: true, title: true } },
            selectedVariant: { select: { platform: true, hook: true, body: true, cta: true, status: true } },
            qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        blog: {
          include: {
            featureAsset: { select: { fileUrl: true, title: true } },
            qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        publishedPosts: { select: { id: true, status: true } },
      },
      orderBy: [{ scheduledFor: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.connectedAccount.findMany({
      where: {
        platform: { in: [SocialPlatform.facebook, SocialPlatform.instagram] },
        status: { in: [ConnectedAccountStatus.active, ConnectedAccountStatus.needs_reauth, ConnectedAccountStatus.error] },
      },
    }),
  ]);

  const items = schedules
    .map((schedule) => ({ schedule, readiness: getMetaPublishReadiness(schedule, accounts) }))
    .filter(({ schedule, readiness }) => {
      const scheduleBrand = schedule.brand ?? schedule.content?.brand ?? schedule.blog?.brand;
      if (brand && scheduleBrand?.toLowerCase() !== brand) return false;
      if (queue === "ready" && !readiness.ready) return false;
      if (queue === "blocked" && readiness.ready) return false;
      return true;
    })
    .slice(0, limit);

  return {
    toolName: "get_meta_publishing_readiness",
    summary: `Found ${items.filter((item) => item.readiness.ready).length} Meta-ready and ${items.filter((item) => !item.readiness.ready).length} blocked schedule item${items.length === 1 ? "" : "s"}.`,
    payload: {
      count: items.length,
      items: items.map(({ schedule, readiness }) => ({
        id: schedule.id,
        title: schedule.content?.title ?? schedule.blog?.title ?? "Untitled scheduled item",
        brand: schedule.brand ?? schedule.content?.brand ?? schedule.blog?.brand,
        scheduledFor: schedule.scheduledFor.toISOString(),
        channel: schedule.channel,
        ready: readiness.ready,
        label: readiness.label,
        reasons: readiness.reasons,
        platform: readiness.platform,
        account: readiness.account,
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
  if (args.publishedPostId !== undefined || args.historyNote !== undefined) return reconcilePublishedSchedule(args, context.access.id);
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
  const [contentCounts, blogCounts, upcomingSchedule, recentActions, pendingRunwayStarts] = await Promise.all([
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
    prisma.mediaGenerationJob.count({ where: { provider: "runway", status: "queued", input: { path: ["startRequested"], equals: true } } }),
  ]);

  return {
    toolName: "get_dashboard_summary",
    summary: "Retrieved dashboard summary.",
    payload: {
      pendingRunwayStarts,
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
  const category = asOptionalString(args.category);
  const imageType = asOptionalString(args.imageType);
  const itemType = asOptionalString(args.itemType);
  const search = asOptionalString(args.search);
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 25) : 12;

  const items = await prisma.asset.findMany({
    where: {
      brand: brand ?? undefined,
      campaignName: campaignName ?? undefined,
      sport: sport ?? undefined,
      region: region ?? undefined,
      country: country ?? undefined,
      category: category ?? undefined,
      imageType: imageType ?? undefined,
      itemType: itemType ?? undefined,
      OR: search
        ? [
            { title: { contains: search, mode: "insensitive" } },
            { altText: { contains: search, mode: "insensitive" } },
            { caption: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
            { itemName: { contains: search, mode: "insensitive" } },
            { itemType: { contains: search, mode: "insensitive" } },
            { imageType: { contains: search, mode: "insensitive" } },
            { tags: { has: search } },
          ]
        : undefined,
    },
    orderBy: [{ featured: "desc" }, { syncedAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
    include: {
      _count: {
        select: {
          contentPrimaryFor: true,
          blogFeatureFor: true,
          contentLinks: true,
          blogLinks: true,
          campaignLinks: true,
        },
      },
    },
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
        description: item.description,
        category: item.category,
        itemName: item.itemName,
        itemId: item.itemId,
        itemType: item.itemType,
        imageType: item.imageType,
        featured: item.featured,
        orientation: item.orientation,
        brand: item.brand,
        campaignName: item.campaignName,
        sport: item.sport,
        region: item.region,
        country: item.country,
        tags: item.tags,
        usageCount: getAssetUsageCount(item),
      })),
    },
  };
}

async function recommendAssetsForContentTool(args: Record<string, unknown>) {
  const search = [
    asOptionalString(args.search),
    asOptionalString(args.topic),
    asOptionalString(args.campaignName),
    asOptionalString(args.brand),
    asOptionalString(args.region),
    asOptionalString(args.country),
    asOptionalString(args.category),
  ]
    .filter(Boolean)
    .join(" ");
  const searchTerms = search.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 10) : 5;
  const candidates = await prisma.asset.findMany({
    where: {
      AND: [
        {
          OR: [{ mediaType: "image" }, { mediaType: null }],
        },
        ...(searchTerms.length > 0
        ? [
            {
              OR: [
                ...searchTerms.flatMap((term) => [
                  { title: { contains: term, mode: "insensitive" as const } },
                  { altText: { contains: term, mode: "insensitive" as const } },
                  { caption: { contains: term, mode: "insensitive" as const } },
                  { description: { contains: term, mode: "insensitive" as const } },
                  { itemName: { contains: term, mode: "insensitive" as const } },
                  { category: { contains: term, mode: "insensitive" as const } },
                ]),
                { tags: { hasSome: searchTerms } },
              ],
            },
          ]
        : []),
      ],
    },
    orderBy: [{ featured: "desc" }, { syncedAt: "desc" }, { updatedAt: "desc" }],
    take: 80,
    include: {
      _count: {
        select: {
          contentPrimaryFor: true,
          blogFeatureFor: true,
          contentLinks: true,
          blogLinks: true,
          campaignLinks: true,
        },
      },
    },
  });

  const scored = candidates
    .map((asset) => scoreAssetRecommendation(asset, args))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    toolName: "recommend_assets_for_content",
    summary: `Recommended ${scored.length} asset${scored.length === 1 ? "" : "s"} for this content context.`,
    payload: {
      count: scored.length,
      items: scored.map(({ asset, score, reasons }) => ({
        id: asset.id,
        title: asset.title,
        fileUrl: asset.fileUrl,
        thumbnailUrl: asset.thumbnailUrl,
        description: asset.description,
        caption: asset.caption,
        category: asset.category,
        itemName: asset.itemName,
        itemType: asset.itemType,
        imageType: asset.imageType,
        featured: asset.featured,
        region: asset.region,
        country: asset.country,
        tags: asset.tags,
        usageCount: getAssetUsageCount(asset),
        recommendationScore: score,
        reasons,
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

async function syncTsadbAssetsTool(args: Record<string, unknown>, context: ToolContext) {
  const ownerId = asOptionalString(args.ownerId);
  const salesItemId = asOptionalString(args.salesItemId);
  const limit = typeof args.limit === "number" ? Math.min(Math.max(args.limit, 1), 5000) : 5000;
  const result = await syncTsadbImages({ ownerId, salesItemId, limit });

  await createActionLog({
    userId: context.access.id,
    actionType: "sync",
    targetType: "asset",
    targetId: ownerId ?? salesItemId ?? "tsadb",
    summary: `AI synced ${result.count} enriched TSADB asset${result.count === 1 ? "" : "s"}`,
    afterData: {
      count: result.count,
      sourceRecordCount: result.sourceRecordCount,
      newAssets: result.newAssets,
      skipped: result.skipped,
      ownerId,
      salesItemId,
      limit,
    },
    source: "ai",
  });

  return {
    toolName: "sync_tsadb_assets",
    summary: `Synced ${result.sourceRecordCount} TSADB source record${result.sourceRecordCount === 1 ? "" : "s"} and linked ${result.newAssets} new physical asset${result.newAssets === 1 ? "" : "s"}.`,
    payload: {
      count: result.count,
      sourceRecordCount: result.sourceRecordCount,
      newAssets: result.newAssets,
      skipped: result.skipped,
      items: result.assets.slice(0, 10).map((asset) => ({
        id: asset.id,
        title: asset.title,
        fileUrl: asset.fileUrl,
        description: asset.description,
        category: asset.category,
        region: asset.region,
        country: asset.country,
      })),
    },
  };
}

function getAssetUsageCount(asset: {
  _count: {
    contentPrimaryFor: number;
    blogFeatureFor: number;
    contentLinks: number;
    blogLinks: number;
    campaignLinks: number;
  };
}) {
  return (
    asset._count.contentPrimaryFor +
    asset._count.blogFeatureFor +
    asset._count.contentLinks +
    asset._count.blogLinks +
    asset._count.campaignLinks
  );
}

function scoreAssetRecommendation<
  T extends {
    title: string;
    altText: string | null;
    caption: string | null;
    description: string | null;
    category: string | null;
    itemName: string | null;
    itemType: string | null;
    imageType: string | null;
    featured: boolean;
    region: string | null;
    country: string | null;
    brand: string | null;
    campaignName: string | null;
    tags: string[];
    _count: {
      contentPrimaryFor: number;
      blogFeatureFor: number;
      contentLinks: number;
      blogLinks: number;
      campaignLinks: number;
    };
  },
>(asset: T, args: Record<string, unknown>) {
  const criteria = {
    brand: asOptionalString(args.brand),
    campaignNa…11833 tokens truncated… new Error("This plan item does not have a video production brief.");
  const jobs = await prisma.mediaGenerationJob.findMany({
    where: {
      OR: [
        { targetType: "video_brief", targetId: item.videoBrief.id },
        { targetType: "video_shot", targetId: { in: item.videoBrief.shots.map((shot) => shot.id) } },
      ],
    },
    select: { id: true, status: true, provider: true, targetType: true, targetId: true, error: true, externalTaskId: true, outputAssetId: true, costCents: true, input: true },
    orderBy: { updatedAt: "desc" },
  });
  const speakingTests = await prisma.mediaGenerationJob.findMany({
    where: { provider: "runway", targetType: "character_speech", input: { path: ["planId"], equals: item.planId } },
    select: { id: true, status: true, error: true, externalTaskId: true, outputAssetId: true, input: true },
    orderBy: { updatedAt: "desc" },
  });
  const assemblyJobs = await prisma.mediaGenerationJob.findMany({
    where: { provider: "local_editor", targetType: "video_assembly", targetId: planItemId },
    select: { id: true, status: true, error: true, outputAssetId: true, input: true },
    orderBy: { updatedAt: "desc" },
  });
  const audioInspections = await prisma.mediaGenerationJob.findMany({
    where: { provider: "openai", targetType: "audio_inspection", input: { path: ["planItemId"], equals: planItemId } },
    select: { id: true, status: true, error: true, input: true },
    orderBy: { updatedAt: "desc" },
  });
  const videoInspections = await prisma.mediaGenerationJob.findMany({
    where: { provider: "openai", targetType: "video_inspection", input: { path: ["planItemId"], equals: planItemId } },
    select: { id: true, status: true, error: true, input: true },
    orderBy: { updatedAt: "desc" },
  });
  const status = getUnifiedProductionStatus({
    contentStatus: item.content?.status,
    briefStatus: item.videoBrief.status,
    shotStatuses: item.videoBrief.shots.map((shot) => shot.status),
    generationStatuses: jobs.map((job) => job.status),
    scheduleStatus: item.schedule?.status,
  });
  return {
    toolName: "get_production_status",
    summary: `${status.label}: ${status.summary}`,
    payload: {
      planItemId,
      title: item.title,
      status,
      briefStatus: item.videoBrief.status,
      shotCount: item.videoBrief.shots.length,
      jobs,
      speakingTests,
      assemblyJobs,
      audioInspections,
      videoInspections,
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
  get_meta_publishing_readiness: async (args) => getMetaPublishingReadinessTool(args),
  create_schedule_entry: createScheduleEntryTool,
  update_schedule_entry: updateScheduleEntryTool,
  get_dashboard_summary: async () => getDashboardSummaryTool(),
  list_assets: async (args) => listAssetsTool(args),
  recommend_assets_for_content: async (args) => recommendAssetsForContentTool(args),
  sync_wordpress_assets: async (_args, context) => syncWordPressAssetsTool(context),
  sync_tsadb_assets: async (args, context) => syncTsadbAssetsTool(args, context),
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
  get_performance_insights: async (args) => getPerformanceInsightsTool(args),
  sync_social_accounts: syncSocialAccountsTool,
  publish_schedule_to_meta: publishScheduleToMetaTool,
  list_automations: async (args) => listAutomationsTool(args),
  get_automation_health: async () => getAutomationHealthTool(),
  run_automation: runAutomationTool,
  list_content_plans: async (args) => listContentPlansTool(args),
  create_content_plan: createContentPlanTool,
  add_content_plan_item: addContentPlanItemTool,
  generate_ai_content_plan: generateAiContentPlanTool,
  generate_content_variants: generateContentVariantsTool,
  generate_video_brief: generateVideoBriefTool,
  update_video_brief: updateVideoBriefTool,
  add_editorial_comment: addEditorialCommentTool,
  resolve_editorial_comment: resolveEditorialCommentTool,
  set_plan_media_budget: async (args, context) => {
    const plan = await setPlanMediaBudget(asRequiredString(args.planId, "planId"), Number(args.creditBudget), context.access.id);
    return { toolName: "set_plan_media_budget", summary: "Updated plan production credit budget.", payload: { planId: plan.id, creditBudget: plan.mediaCreditBudget } };
  },
  queue_video_generation: queueVideoGenerationTool,
  get_production_status: async (args) => getProductionStatusTool(args),
  get_quality_summary: async () => getQualitySummaryTool(),
  review_quality: reviewQualityTool,
  apply_quality_recommendations: applyQualityRecommendationsTool,
  promote_content_plan_item: promoteContentPlanItemTool,
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
      name: "get_meta_publishing_readiness",
      description: "Inspect Facebook and Instagram schedule entries using the live publishing readiness rules. Use this before proposing a Meta publish.",
      parameters: {
        type: "object",
        properties: {
          queue: { type: "string", enum: ["all", "ready", "blocked"] },
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
          publishedPostId: { type: "string", description: "Historical reconciliation only: link an existing imported provider post. Cannot be combined with ordinary edits." },
          historyNote: { type: "string", maxLength: 2000, description: "Audited note on an already-published schedule; does not verify publication without provider evidence." },
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
          category: { type: "string" },
          itemType: { type: "string" },
          imageType: { type: "string" },
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
      name: "recommend_assets_for_content",
      description: "Recommend the best image assets for a content idea, plan item, campaign, platform, brand, region, or topic.",
      parameters: {
        type: "object",
        properties: {
          brand: { type: "string" },
          campaignName: { type: "string" },
          topic: { type: "string" },
          platform: { type: "string" },
          region: { type: "string" },
          country: { type: "string" },
          category: { type: "string" },
          itemType: { type: "string" },
          imageType: { type: "string" },
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
      name: "sync_tsadb_assets",
      description: "Sync enriched TSADB image metadata into the internal asset catalog. Use this when the user wants the WordPress image library to become searchable by region, category, item, and description.",
      parameters: {
        type: "object",
        properties: {
          ownerId: { type: "string" },
          salesItemId: { type: "string" },
          limit: { type: "number" },
        },
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
      name: "get_performance_insights",
      description: "Build current performance benchmarks by brand and channel from the latest synced analytics snapshots, with cautious planning signals.",
      parameters: {
        type: "object",
        properties: {
          brand: { type: "string" },
          platform: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sync_social_accounts",
      description: "Sync due active Facebook and Instagram accounts into published post history and analytics snapshots.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
          staleAfterHours: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publish_schedule_to_meta",
      description: "Publish one approved, quality-ready schedule entry to its matched Facebook or Instagram account. This is a live external action and always requires operator approval.",
      parameters: {
        type: "object",
        properties: {
          scheduleId: { type: "string" },
        },
        required: ["scheduleId"],
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
          objective: { type: "string" },
          targetAudience: { type: "string" },
          keyMessage: { type: "string" },
          callToAction: { type: "string" },
          tone: { type: "string" },
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
      name: "generate_content_variants",
      description: "Generate and save platform-specific variants for an existing short-form content record.",
      parameters: {
        type: "object",
        properties: {
          contentId: { type: "string" },
          platforms: { type: "array", items: { type: "string" } },
        },
        required: ["contentId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_video_brief",
      description: "Generate and save a production-ready storyboard for a video plan item. This creates a reviewable brief only; it does not call a video provider or spend generation credits.",
      parameters: {
        type: "object",
        properties: {
          planItemId: { type: "string" },
          durationSeconds: { type: "number", description: "Total runtime, normally 15, 30, 45, or 60 seconds." },
          aspectRatio: { type: "string", description: "For example 9:16, 1:1, or 16:9." },
          targetPlatforms: { type: "array", items: { type: "string" } },
          guidance: { type: "string" },
        },
        required: ["planItemId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_video_brief",
      description: "Apply a targeted, reviewable edit to an existing video storyboard. Use shotEdits for specific shots and include a concise changeSummary. This does not generate media.",
      parameters: {
        type: "object",
        properties: {
          planItemId: { type: "string" },
          concept: { type: "string" },
          script: { type: "string" },
          voiceover: { type: "string" },
          onScreenText: { type: "string" },
          audioDirection: { type: "string" },
          visualDirection: { type: "string" },
          generationStrategy: { type: "string" },
          durationSeconds: { type: "number" },
          aspectRatio: { type: "string" },
          targetPlatforms: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["draft", "review", "approved", "generating", "ready", "rejected"] },
          changeSummary: { type: "string" },
          shotEdits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                shotId: { type: "string" },
                title: { type: "string" },
                durationSeconds: { type: "number" },
                purpose: { type: "string" },
                prompt: { type: "string" },
                cameraDirection: { type: "string" },
                visualDetails: { type: "string" },
                onScreenText: { type: "string" },
                voiceover: { type: "string" },
                status: { type: "string", enum: ["planned", "approved", "generating", "ready", "needs_changes"] },
              },
              required: ["shotId"],
              additionalProperties: false,
            },
          },
        },
        required: ["planItemId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_editorial_comment",
      description: "Add a review comment or change request to a content record, video brief, or specific video shot.",
      parameters: {
        type: "object",
        properties: {
          targetType: { type: "string", description: "For example content, video_brief, or video_shot." },
          targetId: { type: "string" },
          body: { type: "string" },
          sectionKey: { type: "string" },
          fieldKey: { type: "string" },
          isChangeRequest: { type: "boolean" },
          parentId: { type: "string" },
        },
        required: ["targetType", "targetId", "body"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resolve_editorial_comment",
      description: "Resolve an open editorial comment or change request after it has been addressed.",
      parameters: {
        type: "object",
        properties: { commentId: { type: "string" } },
        required: ["commentId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queue_video_generation",
      description: "Queue an approved individual shot for Runway Dev generation. The job may run and incur charges asynchronously if the runner is enabled. Set a plan budget first.",
      parameters: {
        type: "object",
        properties: {
          planItemId: { type: "string" },
          provider: { type: "string", description: "Provider name, currently runway-ready by default." },
          shotId: { type: "string", description: "Approved shot id for single-shot generation." },
          guidance: { type: "string" },
          referenceAssetId: { type: "string", description: "Approved same-brand image: first frame with Gen-4.5 or image reference with Seedance Mini." },
          additionalReferenceAssetIds: { type: "array", items: { type: "string" }, maxItems: 3, description: "Additional approved same-brand images; Seedance Mini only." },
          model: { type: "string", enum: ["gen4.5", "seedance2_mini"], description: "Gen-4.5 animates a single first frame; Seedance Mini uses up to four image references at 720p." },
          maxCredits: { type: "number", description: "Maximum estimated credits for this shot, at most 225; not a provider-enforced billing cap." },
        },
        required: ["planItemId", "shotId", "referenceAssetId", "maxCredits"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_production_status",
      description: "Read the unified production status for a video plan item across its brief, shots, generation jobs, content, and schedule.",
      parameters: {
        type: "object",
        properties: { planItemId: { type: "string" } },
        required: ["planItemId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_ai_content_plan",
      description: "Generate and save a 14-day AI content plan from current planner signals.",
      parameters: {
        type: "object",
        properties: {
          planningMode: { type: "string", enum: ["new_content", "balanced", "cleanup", "campaign_launch", "calendar_gaps", "variants"] },
          brand: { type: "string" },
          campaignName: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          channels: { type: "array", items: { type: "string" } },
          itemCount: { type: "number" },
          region: { type: "string" },
          country: { type: "string" },
          sport: { type: "string" },
          goal: { type: "string" },
          guidance: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_quality_summary",
      description: "Get the editorial quality command summary, including weak reviewed work and active items missing reviews.",
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
  {
    type: "function",
    function: {
      name: "apply_quality_recommendations",
      description: "Apply the latest saved quality review recommendations to a short-form content record.",
      parameters: {
        type: "object",
        properties: {
          contentId: { type: "string" },
        },
        required: ["contentId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "promote_content_plan_item",
      description: "Promote a saved content plan item into a content record, blog record, or schedule entry.",
      parameters: {
        type: "object",
        properties: {
          planItemId: { type: "string" },
          target: { type: "string", enum: ["content", "blog", "schedule"] },
        },
        required: ["planItemId", "target"],
        additionalProperties: false,
      },
    },
  },
];

contentOpsTools.push({ type: "function", function: { name: "set_plan_media_budget", description: "Set the total Runway credit reservation limit for one plan. Changing the budget never starts generation.", parameters: { type: "object", properties: { planId: { type: "string" }, creditBudget: { type: "integer" } }, required: ["planId", "creditBudget"], additionalProperties: false } } });

// Quill and ChatGPT use the same brand-kit operations and validation.
for (const operation of [...brandKitOperations, ...mediaRecoveryOperations, ...videoApprovalOperations, ...videoTestOperations, ...runwayStartOperations]) {
  contentOpsTools.push({ type: "function", function: { name: operation.name, description: operation.description, parameters: operation.inputSchema } });
  toolHandlers[operation.name] = async (args, context) => {
    validateMcpInput(operation.inputSchema, args);
    const result = await operation.run(args, context.access);
    return { toolName: operation.name, summary: operation.description, payload: result };
  };
}

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
