import { executeContentOpsTool } from "@/lib/ai/tools";
import { getOrCreateAtlasActor } from "@/lib/external/atlas-actor";

/** Tools Atlas may call on content.ixara.tech (Quill capabilities moved to Atlas). */
export const ATLAS_ALLOWED_TOOLS = new Set([
  "list_content",
  "create_content",
  "update_content",
  "list_blogs",
  "create_blog",
  "update_blog",
  "list_schedule_entries",
  "create_schedule_entry",
  "update_schedule_entry",
  "get_dashboard_summary",
  "list_assets",
  "list_brand_profiles",
  "get_brand_profile",
  "list_campaigns",
  "get_campaign",
  "list_connected_accounts",
  "list_published_posts",
  "get_top_performing_posts",
  "list_automations",
  "get_automation_health",
  "list_content_plans",
  "create_content_plan",
  "add_content_plan_item",
  "generate_ai_content_plan",
  "get_quality_summary",
  "review_quality",
  "apply_quality_recommendations",
  "promote_content_plan_item",
  "generate_content_variants",
]);

export async function executeAtlasContentTool(
  toolName: string,
  args: Record<string, unknown> = {},
) {
  if (!ATLAS_ALLOWED_TOOLS.has(toolName)) {
    throw new Error(`Tool "${toolName}" is not available to Atlas yet.`);
  }

  const access = await getOrCreateAtlasActor();
  return executeContentOpsTool(toolName, args, { access });
}
