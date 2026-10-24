type PostBrandSource = {
  sourceBrandName?: string | null;
  sourceExternalAccountId?: string | null;
  content?: { brand: string | null } | null;
  blog?: { brand: string | null } | null;
  connectedAccount?: {
    externalAccountId?: string | null;
    brandName?: string | null;
    brandProfile?: { brandName: string } | null;
  } | null;
};

export function publishedPostBrand(post: PostBrandSource) {
  const account = post.connectedAccount;
  const sameSource = !post.sourceExternalAccountId || post.sourceExternalAccountId === account?.externalAccountId;
  return post.content?.brand ?? post.blog?.brand ?? post.sourceBrandName ??
    (sameSource ? account?.brandProfile?.brandName ?? account?.brandName : null) ?? null;
}

export function metricRate(numerator: number | null, denominator: number | null) {
  return numerator !== null && denominator !== null && denominator > 0
    ? Number(((numerator / denominator) * 100).toFixed(2)) : null;
}

export function hasEngagementRate(snapshot: { engagementRate: number | null } | null | undefined) {
  return snapshot?.engagementRate != null && Number.isFinite(snapshot.engagementRate);
}

export function hasPerformanceMetrics(snapshot: {
  impressions?: number | null; views?: number | null; reach?: number | null;
  engagements?: number | null; likes?: number | null; comments?: number | null;
  shares?: number | null; saves?: number | null; clicks?: number | null;
} | null | undefined) {
  return snapshot != null && [snapshot.impressions, snapshot.views, snapshot.reach,
    snapshot.engagements, snapshot.likes, snapshot.comments, snapshot.shares,
    snapshot.saves, snapshot.clicks].some((value) => value != null);
}
