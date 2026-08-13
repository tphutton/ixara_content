import type { BrandProfile } from "@prisma/client";

type Requirement = {
  key: string;
  label: string;
  met: boolean;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasList(values: string[] | null | undefined) {
  return Boolean(values?.some((value) => value.trim().length > 0));
}

export function getBrandProfileReadiness(profile: BrandProfile) {
  const requirements: Requirement[] = [
    { key: "description", label: "Brand description", met: hasText(profile.description) },
    { key: "positioning", label: "Positioning", met: hasText(profile.positioning) },
    { key: "tone", label: "Tone", met: hasText(profile.defaultTone) },
    { key: "audience", label: "Audience", met: hasText(profile.targetAudience) },
    { key: "websites", label: "Preferred websites", met: hasList(profile.preferredWebsites) },
    { key: "ctas", label: "Preferred CTAs", met: hasList(profile.preferredCTAs) },
    { key: "pillars", label: "Content pillars", met: hasList(profile.contentPillars) },
    { key: "personas", label: "Audience personas", met: hasList(profile.audiencePersonas) },
    { key: "offers", label: "Key offers", met: hasList(profile.keyOffers) },
    { key: "proof", label: "Proof points", met: hasList(profile.proofPoints) },
    { key: "seo", label: "SEO keywords", met: hasList(profile.seoKeywords) },
    { key: "voice", label: "Voice examples", met: hasList(profile.voiceExamples) },
    { key: "banned", label: "Banned phrases", met: hasList(profile.bannedPhrases) },
    {
      key: "channels",
      label: "Channel guidelines",
      met: [
        profile.instagramGuidelines,
        profile.facebookGuidelines,
        profile.linkedinGuidelines,
        profile.blogGuidelines,
        profile.emailGuidelines,
        profile.adGuidelines,
      ].some(hasText),
    },
  ];

  const completed = requirements.filter((item) => item.met).length;
  const score = Math.round((completed / requirements.length) * 100);
  const missing = requirements.filter((item) => !item.met);

  return {
    score,
    completed,
    total: requirements.length,
    missing,
    status: score >= 85 ? "ready" : score >= 60 ? "review" : "warning",
  };
}

export function compactBrandContext(profile: BrandProfile) {
  const channelGuidelines = [
    profile.instagramGuidelines ? `Instagram: ${profile.instagramGuidelines}` : null,
    profile.facebookGuidelines ? `Facebook: ${profile.facebookGuidelines}` : null,
    profile.linkedinGuidelines ? `LinkedIn: ${profile.linkedinGuidelines}` : null,
    profile.blogGuidelines ? `Blog: ${profile.blogGuidelines}` : null,
    profile.emailGuidelines ? `Email: ${profile.emailGuidelines}` : null,
    profile.adGuidelines ? `Ads: ${profile.adGuidelines}` : null,
  ].filter(Boolean);

  return [
    `Brand: ${profile.brandName}`,
    profile.description ? `Description: ${profile.description}` : null,
    profile.positioning ? `Positioning: ${profile.positioning}` : null,
    profile.defaultTone ? `Tone: ${profile.defaultTone}` : null,
    profile.targetAudience ? `Audience: ${profile.targetAudience}` : null,
    profile.preferredWebsites.length ? `Websites: ${profile.preferredWebsites.join(", ")}` : null,
    profile.sports.length ? `Sports: ${profile.sports.join(", ")}` : null,
    profile.regions.length ? `Regions: ${profile.regions.join(", ")}` : null,
    profile.countries.length ? `Countries: ${profile.countries.join(", ")}` : null,
    profile.contentPillars.length ? `Content pillars: ${profile.contentPillars.join(", ")}` : null,
    profile.audiencePersonas.length ? `Personas: ${profile.audiencePersonas.join(", ")}` : null,
    profile.keyOffers.length ? `Key offers: ${profile.keyOffers.join(", ")}` : null,
    profile.proofPoints.length ? `Proof points: ${profile.proofPoints.join(", ")}` : null,
    profile.seoKeywords.length ? `SEO keywords: ${profile.seoKeywords.join(", ")}` : null,
    profile.competitors.length ? `Competitors/reference set: ${profile.competitors.join(", ")}` : null,
    profile.voiceExamples.length ? `Voice examples: ${profile.voiceExamples.join(" | ")}` : null,
    profile.visualGuidelines ? `Visual guidelines: ${profile.visualGuidelines}` : null,
    profile.preferredCTAs.length ? `Preferred CTAs: ${profile.preferredCTAs.join(", ")}` : null,
    profile.bannedPhrases.length ? `Banned phrases: ${profile.bannedPhrases.join(", ")}` : null,
    channelGuidelines.length ? `Channel guidelines: ${channelGuidelines.join(" | ")}` : null,
  ].filter(Boolean).join(" | ");
}
