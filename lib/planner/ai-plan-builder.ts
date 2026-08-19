import {
  ContentPlanItemStatus,
  ContentPlanItemType,
  ContentPlanStatus,
  type UserAccess,
} from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { getOpenAIClient } from "@/lib/openai";
import { getContentCommandCenter } from "@/lib/planner/content-command-center";
import { prisma } from "@/lib/prisma";

const PLANNER_MODEL = process.env.OPENAI_PLANNER_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5-mini";

type AiPlanItem = {
  title?: string;
  itemType?: string;
  status?: string;
  brief?: string | null;
  channel?: string | null;
  scheduledFor?: string | null;
  brand?: string | null;
  sport?: string | null;
  region?: string | null;
  country?: string | null;
  campaignName?: string | null;
  assetRequest?: string | null;
};

type AiPlanOutput = {
  title?: string;
  description?: string | null;
  goal?: string | null;
  brand?: string | null;
  campaignName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  items?: AiPlanItem[];
};

export type GenerateAiContentPlanOptions = {
  planningMode?: string | null;
  brand?: string | null;
  campaignName?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  channels?: string[];
  itemCount?: number | null;
  region?: string | null;
  country?: string | null;
  sport?: string | null;
  goal?: string | null;
  guidance?: string | null;
};

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asDate(value: unknown) {
  const raw = asOptionalString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseItemType(value: unknown) {
  return Object.values(ContentPlanItemType).includes(value as ContentPlanItemType)
    ? (value as ContentPlanItemType)
    : ContentPlanItemType.content;
}

function parseItemStatus(value: unknown) {
  return Object.values(ContentPlanItemStatus).includes(value as ContentPlanItemStatus)
    ? (value as ContentPlanItemStatus)
    : ContentPlanItemStatus.planned;
}

function clampItemCount(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 8;
  }

  return Math.min(Math.max(Math.round(value), 3), 20);
}

function formatDateInstruction(date: Date | null | undefined) {
  return date ? date.toISOString() : "not specified";
}

function buildPlannerPrompt(
  summary: Awaited<ReturnType<typeof getContentCommandCenter>>,
  options: GenerateAiContentPlanOptions,
) {
  const itemCount = clampItemCount(options.itemCount);
  const planningMode = asOptionalString(options.planningMode) ?? "balanced";
  const selectedChannels = options.channels?.filter(Boolean) ?? [];
  return `
You are Ixara's AI content planning director. Build a practical content plan from the current operating signals and the operator brief.

Return only valid JSON with:
title, description, goal, brand, campaignName, startDate, endDate, items.

items must be an array of ${itemCount} work units. Each item must include:
title, itemType, status, brief, channel, scheduledFor, brand, sport, region, country, campaignName, assetRequest.

Allowed itemType values: ${Object.values(ContentPlanItemType).join(", ")}.
Allowed status values: ${Object.values(ContentPlanItemStatus).join(", ")}.

Planning standards:
- Respect the operator brief before general planner signals.
- Planning mode: ${planningMode}.
- Brand focus: ${asOptionalString(options.brand) ?? "use the strongest opportunity from current signals"}.
- Campaign focus: ${asOptionalString(options.campaignName) ?? "use relevant active/upcoming campaigns if useful"}.
- Date range: ${formatDateInstruction(options.startDate)} to ${formatDateInstruction(options.endDate)}.
- Channel focus: ${selectedChannels.length > 0 ? selectedChannels.join(", ") : "choose the best channel mix from signals"}.
- Region: ${asOptionalString(options.region) ?? "not specified"}.
- Country: ${asOptionalString(options.country) ?? "not specified"}.
- Sport/category: ${asOptionalString(options.sport) ?? "not specified"}.
- Operator goal: ${asOptionalString(options.goal) ?? "not specified"}.
- Extra guidance: ${asOptionalString(options.guidance) ?? "not specified"}.
- For "new_content", produce fresh content/blog/schedule ideas instead of cleanup tasks unless there is a critical blocker.
- For "cleanup", prioritize fixing existing plans, drafts, metadata, quality, and schedule readiness.
- For "campaign_launch", build a campaign launch sequence.
- For "calendar_gaps", fill under-covered dates/channels.
- For "variants", plan platform adaptations from strong existing content.
- Otherwise prioritize urgent blockers, campaign windows, under-covered brands/channels, and quality/readiness gaps.
- Make every item specific enough for an operator to promote into content, blog, or schedule work.
- Include asset requests when media context is missing.
- Use scheduledFor only when a credible timing suggestion is available inside the operator date range, or in the next 14 days if no range was supplied.
- Do not invent facts outside the signals below.

Metrics:
${summary.metrics.map((metric) => `- ${metric.label}: ${metric.value} (${metric.detail})`).join("\n")}

Planning gaps:
${summary.strategyGaps.map((gap) => `- ${gap.title}: ${gap.detail}`).join("\n") || "No explicit gaps."}

Brand coverage:
${summary.brandCoverage.map((brand) => `- ${brand.brand}: scheduled ${brand.scheduled}, ready ${brand.ready}, attention ${brand.attention}, drafts ${brand.drafts}, blogs ${brand.blogs}, campaigns ${brand.campaigns}`).join("\n") || "No brand coverage."}

Channel load:
${summary.channelLoad.map((channel) => `- ${channel.label}: ${channel.value}`).join("\n") || "No channels assigned."}

Upcoming schedule:
${summary.upcomingSchedule.map((item) => `- ${item.title}: ${item.brand ?? "No brand"}, ${item.channel ?? "No channel"}, ${item.status}, ${item.scheduledFor.toISOString()}, ready ${item.isReady}, blockers ${item.reasons.join("; ")}`).join("\n") || "No upcoming schedule."}

Campaign windows:
${summary.campaigns.upcoming.map((campaign) => `- ${campaign.campaign_name}: brands ${campaign.brand.join(", ") || "none"}, status ${campaign.campaign_status}, type ${campaign.campaign_type ?? "unknown"}, start ${campaign.start_date ?? "TBD"}, end ${campaign.end_date ?? "TBD"}`).join("\n") || "No active campaign windows."}

Performance:
- Recent published posts: ${summary.performanceSignals.recentPublishedCount}
- Active platforms: ${summary.performanceSignals.activePlatforms.join(", ") || "none"}
`.trim();
}

function normalizePlan(value: unknown): Required<Omit<AiPlanOutput, "items">> & { items: AiPlanItem[] } {
  const input = value && typeof value === "object" ? (value as AiPlanOutput) : {};
  const now = new Date();
  const startDate = asOptionalString(input.startDate) ?? now.toISOString();
  const endDate =
    asOptionalString(input.endDate) ??
    new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString();

  return {
    title: asOptionalString(input.title) ?? "AI 14-day content plan",
    description:
      asOptionalString(input.description) ??
      "AI-generated operating plan from current planner signals.",
    goal:
      asOptionalString(input.goal) ??
      "Improve publishing readiness, fill calendar gaps, and focus creative work on the highest-impact opportunities.",
    brand: asOptionalString(input.brand),
    campaignName: asOptionalString(input.campaignName),
    startDate,
    endDate,
    items: Array.isArray(input.items) ? input.items.slice(0, 20) : [],
  };
}

function buildSourcePrompt(options: GenerateAiContentPlanOptions) {
  const entries = [
    `mode=${asOptionalString(options.planningMode) ?? "balanced"}`,
    `brand=${asOptionalString(options.brand) ?? "auto"}`,
    `campaign=${asOptionalString(options.campaignName) ?? "auto"}`,
    `start=${options.startDate?.toISOString() ?? "auto"}`,
    `end=${options.endDate?.toISOString() ?? "auto"}`,
    `channels=${options.channels?.join(", ") || "auto"}`,
    `items=${clampItemCount(options.itemCount)}`,
    `region=${asOptionalString(options.region) ?? "auto"}`,
    `country=${asOptionalString(options.country) ?? "auto"}`,
    `sport=${asOptionalString(options.sport) ?? "auto"}`,
  ];

  return `AI-generated from /planner command signals. Operator brief: ${entries.join("; ")}.${options.goal ? ` Goal: ${options.goal}.` : ""}${options.guidance ? ` Guidance: ${options.guidance}.` : ""}`;
}

export async function generateAiContentPlan(
  access: UserAccess,
  options: GenerateAiContentPlanOptions = {},
) {
  const summary = await getContentCommandCenter();
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: PLANNER_MODEL,
    messages: [{ role: "user", content: buildPlannerPrompt(summary, options) }],
    response_format: { type: "json_object" },
  });

  const parsed = normalizePlan(JSON.parse(response.choices[0]?.message.content ?? "{}"));
  const plan = await prisma.contentPlan.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      goal: asOptionalString(options.goal) ?? parsed.goal,
      status: ContentPlanStatus.draft,
      startDate: options.startDate ?? asDate(parsed.startDate),
      endDate: options.endDate ?? asDate(parsed.endDate),
      brand: asOptionalString(options.brand) ?? parsed.brand,
      campaignName: asOptionalString(options.campaignName) ?? parsed.campaignName,
      sourcePrompt: buildSourcePrompt(options),
      createdById: access.id,
      updatedById: access.id,
      items: {
        create: parsed.items.map((item, index) => ({
          title: asOptionalString(item.title) ?? `Planned item ${index + 1}`,
          itemType: parseItemType(item.itemType),
          status: parseItemStatus(item.status),
          brief: asOptionalString(item.brief),
          channel: asOptionalString(item.channel) ?? options.channels?.[index % Math.max(options.channels.length, 1)],
          scheduledFor: asDate(item.scheduledFor),
          brand: asOptionalString(item.brand) ?? asOptionalString(options.brand) ?? parsed.brand,
          sport: asOptionalString(item.sport) ?? asOptionalString(options.sport),
          region: asOptionalString(item.region) ?? asOptionalString(options.region),
          country: asOptionalString(item.country) ?? asOptionalString(options.country),
          campaignName: asOptionalString(item.campaignName) ?? asOptionalString(options.campaignName) ?? parsed.campaignName,
          assetRequest: asOptionalString(item.assetRequest),
          sortOrder: index,
        })),
      },
    },
    include: { items: true },
  });

  await createActionLog({
    userId: access.id,
    actionType: "create",
    targetType: "content_plan",
    targetId: plan.id,
    summary: `AI generated content plan "${plan.title}" with ${plan.items.length} item${plan.items.length === 1 ? "" : "s"}`,
    afterData: plan,
    source: "ai",
  });

  return plan;
}
