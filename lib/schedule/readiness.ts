type LinkedContent = {
  title: string;
  brand: string | null;
  tone: string | null;
  targetAudience: string | null;
  primaryAssetId: string | null;
  assetImage: string | null;
};

type LinkedBlog = {
  title: string;
  brand: string | null;
  websites: string[];
  featureAssetId: string | null;
  featureImage: string | null;
};

type ScheduleReadinessInput = {
  channel: string | null;
  platformAccount: string | null;
  brand: string | null;
  approvedById: string | null;
  content: LinkedContent | null;
  blog: LinkedBlog | null;
};

export type ScheduleReadiness = {
  isReady: boolean;
  reasons: string[];
};

export function getScheduleReadiness(input: ScheduleReadinessInput): ScheduleReadiness {
  const reasons: string[] = [];

  if (!input.content && !input.blog) {
    reasons.push("No linked content or blog record");
  }

  if (!input.channel) {
    reasons.push("No channel selected");
  }

  if (!input.platformAccount) {
    reasons.push("No platform account selected");
  }

  if (!input.approvedById) {
    reasons.push("Not approved for publishing");
  }

  if (input.content) {
    if (!input.content.brand && !input.brand) {
      reasons.push("Content is missing a brand");
    }

    if (!input.content.tone) {
      reasons.push("Content is missing tone");
    }

    if (!input.content.targetAudience) {
      reasons.push("Content is missing target audience");
    }

    if (!input.content.primaryAssetId && !input.content.assetImage) {
      reasons.push("Content is missing a linked asset");
    }
  }

  if (input.blog) {
    if (!input.blog.brand && !input.brand) {
      reasons.push("Blog is missing a brand");
    }

    if (input.blog.websites.length === 0) {
      reasons.push("Blog is missing websites");
    }

    if (!input.blog.featureAssetId && !input.blog.featureImage) {
      reasons.push("Blog is missing a feature image");
    }
  }

  return {
    isReady: reasons.length === 0,
    reasons,
  };
}
