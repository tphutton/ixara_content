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

function buildPlannerPrompt(summary: Awaited<ReturnType<typeof getContentCommandCenter>>) {
  return `
You are Ixara's AI content planning director. Build a practical 14-day content plan from the current operating signals.

Return only valid JSON with:
title, description, goal, brand, campaignName, startDate, endDate, items.

items must be an array of 6-12 work units. Each item must include:
title, itemType, status, brief, channel, scheduledFor, brand, sport, region, country, campaignName, assetRequest.

Allowed itemType values: ${Object.values(ContentPlanItemType).join(", ")}.
Allowed status values: ${Object.values(ContentPlanItemStatus).join(", ")}.

Planning standards:
- Prioritize urgent blockers, campaign windows, under-covered brands/channels, and quality/readiness gaps.
- Make every item specific enough for an operator to promote into content, blog, or schedule work.
- Include asset requests when media context is missing.
- Use scheduledFor only when a credible timing suggestion is available in the next 14 days.
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
    items: Array.isArray(input.items) ? input.items.slice(0, 12) : [],
  };
}

export async function generateAiContentPlan(access: UserAccess) {
  const summary = await getContentCommandCenter();
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: PLANNER_MODEL,
    messages: [{ role: "user", content: buildPlannerPrompt(summary) }],
    response_format: { type: "json_object" },
  });

  const parsed = normalizePlan(JSON.parse(response.choices[0]?.message.content ?? "{}"));
  const plan = await prisma.contentPlan.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      goal: parsed.goal,
      status: ContentPlanStatus.draft,
      startDate: asDate(parsed.startDate),
      endDate: asDate(parsed.endDate),
      brand: parsed.brand,
      campaignName: parsed.campaignName,
      sourcePrompt: "AI-generated from /planner command signals.",
      createdById: access.id,
      updatedById: access.id,
      items: {
        create: parsed.items.map((item, index) => ({
          title: asOptionalString(item.title) ?? `Planned item ${index + 1}`,
          itemType: parseItemType(item.itemType),
          status: parseItemStatus(item.status),
          brief: asOptionalString(item.brief),
          channel: asOptionalString(item.channel),
          scheduledFor: asDate(item.scheduledFor),
          brand: asOptionalString(item.brand) ?? parsed.brand,
          sport: asOptionalString(item.sport),
          region: asOptionalString(item.region),
          country: asOptionalString(item.country),
          campaignName: asOptionalString(item.campaignName) ?? parsed.campaignName,
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
