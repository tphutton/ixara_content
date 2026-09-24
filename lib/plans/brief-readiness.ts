type BriefItem = {
  title: string;
  brief: string | null;
  objective: string | null;
  targetAudience: string | null;
  keyMessage: string | null;
  callToAction: string | null;
  tone: string | null;
  channel: string | null;
  brand: string | null;
  campaignName: string | null;
  assetRequest: string | null;
};

type BriefPlan = {
  goal: string | null;
  brand: string | null;
  campaignName: string | null;
};

type BriefBrandProfile = {
  targetAudience: string | null;
  defaultTone: string | null;
  preferredCTAs: string[];
} | null;

export type EffectiveProductionBrief = {
  objective: string | null;
  targetAudience: string | null;
  keyMessage: string | null;
  callToAction: string | null;
  tone: string | null;
  brand: string | null;
  campaignName: string | null;
};

export function getEffectiveProductionBrief(
  item: BriefItem,
  plan: BriefPlan,
  profile: BriefBrandProfile,
): EffectiveProductionBrief {
  return {
    objective: item.objective ?? plan.goal,
    targetAudience: item.targetAudience ?? profile?.targetAudience ?? null,
    keyMessage: item.keyMessage ?? item.brief,
    callToAction: item.callToAction ?? profile?.preferredCTAs[0] ?? null,
    tone: item.tone ?? profile?.defaultTone ?? null,
    brand: item.brand ?? plan.brand,
    campaignName: item.campaignName ?? plan.campaignName,
  };
}

export function getPlanItemBriefReadiness(
  item: BriefItem,
  plan: BriefPlan,
  profile: BriefBrandProfile,
) {
  const effective = getEffectiveProductionBrief(item, plan, profile);
  const checks = [
    { key: "brief", label: "Creative brief", ready: Boolean(item.brief?.trim()) },
    { key: "objective", label: "Objective", ready: Boolean(effective.objective?.trim()) },
    { key: "audience", label: "Audience", ready: Boolean(effective.targetAudience?.trim()) },
    { key: "message", label: "Key message", ready: Boolean(effective.keyMessage?.trim()) },
    { key: "cta", label: "Call to action", ready: Boolean(effective.callToAction?.trim()) },
    { key: "tone", label: "Tone", ready: Boolean(effective.tone?.trim()) },
    { key: "brand", label: "Brand", ready: Boolean(effective.brand?.trim()) },
    { key: "channel", label: "Channel", ready: Boolean(item.channel?.trim()) },
  ];
  const completed = checks.filter((check) => check.ready).length;

  return {
    ready: completed === checks.length,
    score: Math.round((completed / checks.length) * 100),
    missing: checks.filter((check) => !check.ready),
    effective,
    hasAssetDirection: Boolean(item.assetRequest?.trim()),
  };
}
