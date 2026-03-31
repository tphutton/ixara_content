import {
  BlogStatus,
  ContentStatus,
  ContentType,
  ScheduleStatus,
  type UserAccess,
} from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
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
        updatedAt: item.updatedAt.toISOString(),
      })),
    },
  };
}

async function createContentTool(args: Record<string, unknown>, context: ToolContext) {
  const data = {
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
    aiGenerated: true,
    sourcePrompt: asOptionalString(args.sourcePrompt),
    createdById: context.access.id,
    updatedById: context.access.id,
  };

  const content = await prisma.content.create({ data });

  await createActionLog({
    userId: context.access.id,
    actionType: "create",
    targetType: "content",
    targetId: content.id,
    summary: `AI created content "${content.title}"`,
    afterData: content,
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

  const updated = await prisma.content.update({
    where: { id },
    data: {
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
      campaignName:
        args.campaignName !== undefined ? asOptionalString(args.campaignName) : undefined,
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
      aiGenerated: args.aiGenerated !== undefined ? asBoolean(args.aiGenerated) : undefined,
      sourcePrompt:
        args.sourcePrompt !== undefined ? asOptionalString(args.sourcePrompt) : undefined,
      updatedById: context.access.id,
    },
  });

  await createActionLog({
    userId: context.access.id,
    actionType: "update",
    targetType: "content",
    targetId: updated.id,
    summary: `AI updated content "${updated.title}"`,
    beforeData: before,
    afterData: updated,
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
        category: item.category,
        sport: item.sport,
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

  const data = {
    title: asRequiredString(args.title, "title"),
    postDate: asNullableDate(args.postDate),
    authorName: asOptionalString(args.authorName),
    authorImage: asOptionalString(args.authorImage),
    featureImage: asOptionalString(args.featureImage),
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

  const blog = await prisma.blog.create({ data });

  await createActionLog({
    userId: context.access.id,
    actionType: "create",
    targetType: "blog",
    targetId: blog.id,
    summary: `AI created blog "${blog.title}"`,
    afterData: blog,
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

  const blog = await prisma.blog.update({
    where: { id },
    data: {
      title: asOptionalString(args.title) ?? undefined,
      postDate: args.postDate !== undefined ? asNullableDate(args.postDate) : undefined,
      authorName: args.authorName !== undefined ? asOptionalString(args.authorName) : undefined,
      authorImage: args.authorImage !== undefined ? asOptionalString(args.authorImage) : undefined,
      featureImage:
        args.featureImage !== undefined ? asOptionalString(args.featureImage) : undefined,
      ...dynamicSectionData,
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
    },
  });

  await createActionLog({
    userId: context.access.id,
    actionType: "update",
    targetType: "blog",
    targetId: blog.id,
    summary: `AI updated blog "${blog.title}"`,
    beforeData: before,
    afterData: blog,
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
  list_campaigns: async (args) => listCampaignsTool(args),
  get_campaign: async (args) => getCampaignTool(args),
  upsert_campaign: upsertCampaignTool,
  delete_campaign: deleteCampaignTool,
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
