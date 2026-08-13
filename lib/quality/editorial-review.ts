import {
  QualityReviewTargetType,
  type Blog,
  type BrandProfile,
  type Content,
  type ContentPlanItem,
  type QualityReview,
} from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { compactBrandContext } from "@/lib/brand-profiles/intelligence";
import { getOpenAIClient } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

const QUALITY_MODEL = process.env.OPENAI_QUALITY_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5-mini";

type ReviewTarget =
  | { type: typeof QualityReviewTargetType.content; record: Content }
  | { type: typeof QualityReviewTargetType.blog; record: Blog }
  | { type: typeof QualityReviewTargetType.content_plan_item; record: ContentPlanItem };

type ParsedReview = {
  overallScore: number;
  brandScore: number;
  audienceScore: number;
  clarityScore: number;
  channelScore: number;
  conversionScore: number;
  riskScore: number;
  verdict: string;
  summary: string;
  strengths: string[];
  issues: string[];
  recommendations: string[];
  rewrittenHook?: string | null;
  rewrittenCTA?: string | null;
};

function clampScore(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(100, Math.max(0, Math.round(numberValue)));
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 8);
}

function stripHtml(value: string | null | undefined) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

function contentPrompt(record: Content) {
  return [
    `Target type: short-form content`,
    `Title: ${record.title}`,
    `Status: ${record.status}`,
    `Content type: ${record.contentType}`,
    `Platform/channel: ${record.platform ?? "not set"}`,
    `Brand: ${record.brand ?? "not set"}`,
    `Campaign: ${record.campaignName ?? "not set"}`,
    `Audience: ${record.targetAudience ?? "not set"}`,
    `Tone: ${record.tone ?? "not set"}`,
    `Hook: ${record.hook ?? "not set"}`,
    `Body: ${record.body ?? "not set"}`,
    `CTA: ${record.cta ?? "not set"}`,
    `Tags: ${record.tags.join(", ") || "not set"}`,
    `Asset: ${record.assetImage ?? record.primaryAssetId ?? "not set"}`,
  ].join("\n");
}

function blogPrompt(record: Blog) {
  const sections = Array.from({ length: 8 }, (_, index) => {
    const key = index + 1;
    const text = stripHtml(record[`text${key}` as keyof Blog] as string | null);
    const image = record[`image${key}` as keyof Blog] as string | null;
    const caption = record[`image${key}Caption` as keyof Blog] as string | null;
    return `Section ${key}: ${text || "no copy"} | Image: ${image ? "yes" : "no"} | Caption: ${caption ?? "none"}`;
  }).join("\n");

  return [
    `Target type: structured blog`,
    `Title: ${record.title}`,
    `Status: ${record.status}`,
    `Brand: ${record.brand ?? "not set"}`,
    `Category: ${record.category ?? "not set"}`,
    `Author: ${record.authorName ?? "not set"}`,
    `Websites: ${record.websites.join(", ") || "not set"}`,
    `Sport/region/country: ${[record.sport, record.region, record.country].filter(Boolean).join(", ") || "not set"}`,
    `Tags: ${record.tags.join(", ") || "not set"}`,
    `Feature image: ${record.featureImage ?? record.featureAssetId ?? "not set"}`,
    sections,
  ].join("\n");
}

function planItemPrompt(record: ContentPlanItem) {
  return [
    `Target type: content plan item`,
    `Title: ${record.title}`,
    `Type: ${record.itemType}`,
    `Status: ${record.status}`,
    `Brand: ${record.brand ?? "not set"}`,
    `Campaign: ${record.campaignName ?? "not set"}`,
    `Channel: ${record.channel ?? "not set"}`,
    `Scheduled for: ${record.scheduledFor?.toISOString() ?? "not set"}`,
    `Brief: ${record.brief ?? "not set"}`,
    `Asset request: ${record.assetRequest ?? "not set"}`,
  ].join("\n");
}

function targetPrompt(target: ReviewTarget) {
  if (target.type === QualityReviewTargetType.content) return contentPrompt(target.record);
  if (target.type === QualityReviewTargetType.blog) return blogPrompt(target.record);
  return planItemPrompt(target.record);
}

function matchingBrand(target: ReviewTarget) {
  return target.record.brand;
}

function buildReviewPrompt(target: ReviewTarget, brandProfile: BrandProfile | null) {
  return `
You are Ixara's senior editorial quality director. Review the work below with unusually high standards.

Score 0-100 for each category:
- brandScore: brand voice, offer fit, banned phrase safety, proof-point alignment
- audienceScore: specificity to audience need, pain, desire, and context
- clarityScore: sharpness, structure, friction, readability, and concrete language
- channelScore: fit for the channel, format, length, and likely consumption mode
- conversionScore: strength of hook, CTA, next step, and commercial intent
- riskScore: 100 means low risk; penalize unsupported claims, weak compliance posture, vagueness, missing asset context, or likely publish errors

An exceptional review is specific. Do not be polite at the expense of quality.
Return only valid JSON with:
overallScore, brandScore, audienceScore, clarityScore, channelScore, conversionScore, riskScore,
verdict, summary, strengths, issues, recommendations, rewrittenHook, rewrittenCTA.

Verdict must be one of: publish_ready, improve_before_publish, major_revision.
Recommendations must be concrete edits the operator or AI can apply next.

Brand profile:
${brandProfile ? compactBrandContext(brandProfile) : "No matching brand profile was found. Penalize missing brand intelligence when it affects quality."}

Work to review:
${targetPrompt(target)}
`.trim();
}

function normalizeReview(value: unknown): ParsedReview {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const verdict = asString(input.verdict, "improve_before_publish");
  const allowedVerdicts = new Set(["publish_ready", "improve_before_publish", "major_revision"]);

  return {
    overallScore: clampScore(input.overallScore),
    brandScore: clampScore(input.brandScore),
    audienceScore: clampScore(input.audienceScore),
    clarityScore: clampScore(input.clarityScore),
    channelScore: clampScore(input.channelScore),
    conversionScore: clampScore(input.conversionScore),
    riskScore: clampScore(input.riskScore),
    verdict: allowedVerdicts.has(verdict) ? verdict : "improve_before_publish",
    summary: asString(input.summary, "Quality review completed."),
    strengths: asStringArray(input.strengths),
    issues: asStringArray(input.issues),
    recommendations: asStringArray(input.recommendations),
    rewrittenHook: asString(input.rewrittenHook, ""),
    rewrittenCTA: asString(input.rewrittenCTA, ""),
  };
}

async function getBrandProfile(target: ReviewTarget) {
  const brand = matchingBrand(target);
  if (!brand) return null;

  return prisma.brandProfile.findFirst({
    where: { brandName: { equals: brand, mode: "insensitive" } },
  });
}

async function askAIForReview(target: ReviewTarget) {
  const brandProfile = await getBrandProfile(target);
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: QUALITY_MODEL,
    messages: [
      {
        role: "user",
        content: buildReviewPrompt(target, brandProfile),
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message.content ?? "{}";
  return normalizeReview(JSON.parse(content) as unknown);
}

async function getTarget(targetType: QualityReviewTargetType, targetId: string): Promise<ReviewTarget> {
  if (targetType === QualityReviewTargetType.content) {
    const record = await prisma.content.findUniqueOrThrow({ where: { id: targetId } });
    return { type: targetType, record };
  }

  if (targetType === QualityReviewTargetType.blog) {
    const record = await prisma.blog.findUniqueOrThrow({ where: { id: targetId } });
    return { type: targetType, record };
  }

  const record = await prisma.contentPlanItem.findUniqueOrThrow({ where: { id: targetId } });
  return { type: targetType, record };
}

function targetData(target: ReviewTarget, review: ParsedReview, createdById: string | null) {
  const base = {
    targetType: target.type,
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
    rewrittenHook: review.rewrittenHook || null,
    rewrittenCTA: review.rewrittenCTA || null,
    model: QUALITY_MODEL,
    createdById,
  };

  if (target.type === QualityReviewTargetType.content) {
    return { ...base, contentId: target.record.id };
  }

  if (target.type === QualityReviewTargetType.blog) {
    return { ...base, blogId: target.record.id };
  }

  return { ...base, planItemId: target.record.id };
}

export async function runQualityReview(input: {
  targetType: QualityReviewTargetType;
  targetId: string;
  createdById: string | null;
  source: "manual" | "ai" | "external";
}): Promise<QualityReview> {
  const target = await getTarget(input.targetType, input.targetId);
  const review = await askAIForReview(target);

  const saved = await prisma.qualityReview.create({
    data: targetData(target, review, input.createdById),
  });

  if (input.createdById) {
    await createActionLog({
      userId: input.createdById,
      actionType: "review",
      targetType: "quality_review",
      targetId: saved.id,
      summary: `Quality review scored ${saved.overallScore}/100 with verdict ${saved.verdict}`,
      afterData: saved,
      source: input.source,
    });
  }

  return saved;
}
