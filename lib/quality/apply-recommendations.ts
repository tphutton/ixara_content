import type { BrandProfile, Content, QualityReview } from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { compactBrandContext } from "@/lib/brand-profiles/intelligence";
import { applyBrandRulesToContent } from "@/lib/brand-profiles/rules";
import { getOpenAIClient } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

const QUALITY_MODEL = process.env.OPENAI_QUALITY_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5-mini";

type ImprovedContent = {
  title?: string;
  hook?: string | null;
  body?: string | null;
  cta?: string | null;
  tags?: string[];
  sourcePrompt?: string | null;
};

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 12);
}

function normalizeImprovement(value: unknown): ImprovedContent {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    title: asOptionalString(input.title) ?? undefined,
    hook: asOptionalString(input.hook),
    body: asOptionalString(input.body),
    cta: asOptionalString(input.cta),
    tags: asStringArray(input.tags),
    sourcePrompt: asOptionalString(input.sourcePrompt),
  };
}

async function getBrandProfile(content: Content) {
  if (!content.brand) return null;

  return prisma.brandProfile.findFirst({
    where: { brandName: { equals: content.brand, mode: "insensitive" } },
  });
}

function buildPrompt(content: Content, review: QualityReview, profile: BrandProfile | null) {
  return `
You are Ixara's senior content editor. Improve this short-form content using the saved quality review.

Rules:
- Preserve factual meaning and campaign intent.
- Make the hook sharper, more specific, and less generic.
- Make the body easier to scan and more concrete.
- Make the CTA direct and commercially useful.
- Respect brand profile, banned phrases, preferred CTAs, audience, and channel fit.
- Do not invent unverifiable claims.
- Return only valid JSON with: title, hook, body, cta, tags, sourcePrompt.

Brand profile:
${profile ? compactBrandContext(profile) : "No matching brand profile. Use only the record context and avoid brand claims."}

Current content:
Title: ${content.title}
Platform: ${content.platform ?? "not set"}
Type: ${content.contentType}
Brand: ${content.brand ?? "not set"}
Audience: ${content.targetAudience ?? "not set"}
Tone: ${content.tone ?? "not set"}
Hook: ${content.hook ?? "not set"}
Body: ${content.body ?? "not set"}
CTA: ${content.cta ?? "not set"}
Tags: ${content.tags.join(", ") || "not set"}

Saved quality review:
Score: ${review.overallScore}/100
Verdict: ${review.verdict}
Summary: ${review.summary}
Issues: ${review.issues.join(" | ") || "none"}
Recommendations: ${review.recommendations.join(" | ") || "none"}
Suggested hook: ${review.rewrittenHook ?? "none"}
Suggested CTA: ${review.rewrittenCTA ?? "none"}
`.trim();
}

export async function applyContentQualityRecommendations(input: {
  contentId: string;
  userId: string;
  source: "manual" | "ai";
}) {
  const content = await prisma.content.findUniqueOrThrow({ where: { id: input.contentId } });
  const review = await prisma.qualityReview.findFirst({
    where: { contentId: input.contentId },
    orderBy: { createdAt: "desc" },
  });

  if (!review) {
    throw new Error("Run a quality review before applying recommendations.");
  }

  const profile = await getBrandProfile(content);
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: QUALITY_MODEL,
    messages: [{ role: "user", content: buildPrompt(content, review, profile) }],
    response_format: { type: "json_object" },
  });

  const improved = normalizeImprovement(JSON.parse(response.choices[0]?.message.content ?? "{}"));
  const improvedTags = improved.tags ?? [];
  const prepared = {
    title: improved.title ?? content.title,
    hook: improved.hook ?? content.hook,
    body: improved.body ?? content.body,
    cta: improved.cta ?? content.cta,
    contentType: content.contentType,
    platform: content.platform,
    status: content.status,
    campaignName: content.campaignName,
    brand: content.brand,
    sport: content.sport,
    region: content.region,
    country: content.country,
    tags: improvedTags.length > 0 ? improvedTags : content.tags,
    targetAudience: content.targetAudience,
    tone: content.tone,
    websites: content.websites,
    assetImage: content.assetImage,
    assetCaption: content.assetCaption,
    primaryAssetId: content.primaryAssetId,
    aiGenerated: true,
    sourcePrompt:
      improved.sourcePrompt ??
      `Applied quality review ${review.id} recommendations using ${QUALITY_MODEL}.`,
    updatedById: input.userId,
  };

  const { data, profile: appliedProfile, warnings } = await applyBrandRulesToContent(prepared);
  const updated = await prisma.content.update({
    where: { id: content.id },
    data,
  });

  await createActionLog({
    userId: input.userId,
    actionType: "update",
    targetType: "content",
    targetId: updated.id,
    summary: `Applied quality recommendations to "${updated.title}"${appliedProfile ? ` using ${appliedProfile.brandName} rules` : ""}`,
    beforeData: content,
    afterData: {
      ...updated,
      sourceReviewId: review.id,
      brandWarnings: warnings,
    },
    source: input.source,
  });

  return updated;
}
