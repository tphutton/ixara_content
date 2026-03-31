type BlogReadinessInput = {
  brand: string | null;
  websites: string[];
  featureAssetId: string | null;
  featureImage: string | null;
};

export function getBlogReadiness(input: BlogReadinessInput) {
  const reasons: string[] = [];

  if (!input.brand) reasons.push("brand");
  if (input.websites.length === 0) reasons.push("websites");
  if (!input.featureAssetId && !input.featureImage) reasons.push("feature image");

  return {
    ready: reasons.length === 0,
    reasons,
  };
}
