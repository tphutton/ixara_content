import { ContentStatus, type UserAccess } from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { compactBrandContext } from "@/lib/brand-profiles/intelligence";
import { getOpenAIClient } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

const VARIANT_MODEL = process.env.OPENAI_VARIANT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5-mini";
const DEFAULT_PLATFORMS = ["Instagram", "Facebook", "LinkedIn", "Email"];

type VariantOutput = {
  platform?: string;
  title?: string;
  hook?: string | null;
  body?: string | null;
  cta?: string | null;
  notes?: string | null;
};

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 8);
}

function buildPrompt(input: {
  content: Awaited<ReturnType<typeof getContent>>;
  platforms: string[];
  brandContext: string;
}) {
  return `
You are Ixara's channel adaptation editor. Create platform-specific variants from the source content.

Return only valid JSON with a "variants" array. Each variant must include:
platform, title, hook, body, cta, notes.

Standards:
- Preserve the source idea and campaign intent.
- Adapt format, length, rhythm, CTA, and emphasis to each platform.
- Keep copy concrete, useful, and commercially purposeful.
- Respect brand rules and banned phrases.
- Do not invent factual claims or fake proof.
- Notes should explain asset/crop/format guidance for that platform.

Platforms requested:
${input.platforms.join(", ")}

Brand context:
${input.brandContext}

Source content:
Title: ${input.content.title}
Type: ${input.content.contentType}
Platform: ${input.content.platform ?? "not set"}
Brand: ${input.content.brand ?? "not set"}
Campaign: ${input.content.campaignName ?? "not set"}
Audience: ${input.content.targetAudience ?? "not set"}
Tone: ${input.content.tone ?? "not set"}
Hook: ${input.content.hook ?? "not set"}
Body: ${input.content.body ?? "not set"}
CTA: ${input.content.cta ?? "not set"}
Tags: ${input.content.tags.join(", ") || "not set"}
Asset: ${input.content.assetImage ?? input.content.primaryAssetId ?? "not set"}
`.trim();
}

async function getContent(contentId: string) {
  return prisma.content.findUniqueOrThrow({
    where: { id: contentId },
  });
}

async function getBrandContext(brand: string | null) {
  if (!brand) return "No matching brand profile. Use source content only.";

  const profile = await prisma.brandProfile.findFirst({
    where: { brandName: { equals: brand, mode: "insensitive" } },
  });

  return profile ? compactBrandContext(profile) : "No matching brand profile. Use source content only.";
}

export async function generateContentVariants(input: {
  contentId: string;
  platforms?: string[];
  access: UserAccess;
  source: "manual" | "ai";
}) {
  const content = await getContent(input.contentId);
  const platforms = input.platforms?.length ? input.platforms : DEFAULT_PLATFORMS;
  const brandContext = await getBrandContext(content.brand);
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: VARIANT_MODEL,
    messages: [{ role: "user", content: buildPrompt({ content, platforms, brandContext }) }],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0]?.message.content ?? "{}") as {
    variants?: VariantOutput[];
  };
  const variants = Array.isArray(parsed.variants) ? parsed.variants : [];

  const created = await prisma.$transaction(
    variants.slice(0, 8).map((variant, index) =>
      prisma.contentVariant.create({
        data: {
          contentId: content.id,
          platform: asOptionalString(variant.platform) ?? platforms[index] ?? "Variant",
          title: asOptionalString(variant.title) ?? `${content.title} variant`,
          hook: asOptionalString(variant.hook),
          body: asOptionalString(variant.body),
          cta: asOptionalString(variant.cta),
          notes: asOptionalString(variant.notes),
          status: ContentStatus.draft,
          sourcePrompt: `Generated from content ${content.id} for ${platforms.join(", ")}.`,
          createdById: input.access.id,
          updatedById: input.access.id,
        },
      }),
    ),
  );

  await createActionLog({
    userId: input.access.id,
    actionType: "create",
    targetType: "content_variant",
    targetId: content.id,
    summary: `Generated ${created.length} channel variant${created.length === 1 ? "" : "s"} for "${content.title}"`,
    afterData: {
      contentId: content.id,
      variantIds: created.map((variant) => variant.id),
      platforms: created.map((variant) => variant.platform),
    },
    source: input.source,
  });

  return created;
}

export function parseVariantPlatforms(value: unknown) {
  const parsed = asStringArray(value);
  return parsed.length > 0 ? parsed : DEFAULT_PLATFORMS;
}
