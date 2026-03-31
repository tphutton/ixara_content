export const dashboardMetrics = [
  { label: "Content in Draft", value: "38" },
  { label: "Blogs in Review", value: "12" },
  { label: "Scheduled This Week", value: "27" },
  { label: "AI Actions Today", value: "54" },
];

export const recentActions = [
  {
    action: "Updated blog structure",
    detail: "Expanded APAC motorsport roundup into 6 blocks.",
    time: "5 minutes ago",
  },
  {
    action: "Created social campaign batch",
    detail: "Added 8 draft promo copy records for Thailand and Singapore.",
    time: "18 minutes ago",
  },
  {
    action: "Scheduled content set",
    detail: "Linked 4 short-form posts to next week’s calendar.",
    time: "42 minutes ago",
  },
];

export const contentRows = [
  {
    title: "Masters weekend hype",
    type: "social_post",
    platform: "Instagram",
    status: "draft",
    brand: "TechSport",
    region: "APAC",
  },
  {
    title: "Membership promo CTA",
    type: "promo_copy",
    platform: "Email",
    status: "approved",
    brand: "Ixara",
    region: "Global",
  },
];

export const blogRows = [
  {
    title: "How AI is changing golf booking operations",
    category: "Product",
    status: "review",
    author: "Editorial Ops",
    sport: "Golf",
    region: "Global",
  },
  {
    title: "Thai motorsport weekend preview",
    category: "News",
    status: "draft",
    author: "Regional Desk",
    sport: "Motorsport",
    region: "Thailand",
  },
];

export const scheduleRows = [
  {
    item: "Masters weekend hype",
    channel: "Social",
    scheduledFor: "2026-04-03 09:00",
    status: "planned",
    brand: "TechSport",
  },
  {
    item: "How AI is changing golf booking operations",
    channel: "Blog",
    scheduledFor: "2026-04-05 14:30",
    status: "ready",
    brand: "Ixara",
  },
];

export const approvalRows = [
  {
    name: "Avery Chen",
    email: "avery@example.com",
    role: "editor",
    status: "pending",
  },
  {
    name: "Morgan Silva",
    email: "morgan@example.com",
    role: "viewer",
    status: "approved",
  },
];
