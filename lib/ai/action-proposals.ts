import { Prisma, QuillActionStatus, UserRole, type UserAccess } from "@prisma/client";
import { executeContentOpsTool } from "@/lib/ai/tools";
import { prisma } from "@/lib/prisma";

const MUTATION_TOOLS = new Set([
  "create_content", "update_content", "create_blog", "update_blog",
  "create_schedule_entry", "update_schedule_entry", "sync_wordpress_assets",
  "sync_tsadb_assets", "upsert_brand_profile", "upsert_campaign", "delete_campaign",
  "sync_social_accounts", "run_automation", "create_content_plan",
  "publish_schedule_to_meta",
  "add_content_plan_item", "generate_content_variants", "generate_ai_content_plan",
  "review_quality", "apply_quality_recommendations", "promote_content_plan_item",
]);

const TOOL_LABELS: Record<string, string> = {
  create_content: "Create content", update_content: "Update content",
  create_blog: "Create blog", update_blog: "Update blog",
  create_schedule_entry: "Create schedule entry", update_schedule_entry: "Update schedule entry",
  sync_wordpress_assets: "Sync WordPress assets", sync_tsadb_assets: "Sync TSADB assets",
  upsert_brand_profile: "Save brand profile", upsert_campaign: "Save campaign",
  delete_campaign: "Delete campaign", sync_social_accounts: "Sync social analytics",
  publish_schedule_to_meta: "Publish schedule to Meta",
  run_automation: "Run automation", create_content_plan: "Create content plan",
  add_content_plan_item: "Add plan item", generate_content_variants: "Generate content variants",
  generate_ai_content_plan: "Generate AI content plan", review_quality: "Run quality review",
  apply_quality_recommendations: "Apply quality recommendations",
  promote_content_plan_item: "Promote plan item",
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function describeArguments(args: Record<string, unknown>) {
  const keys = ["title", "brandName", "campaignName", "contentId", "blogId", "scheduleId", "planItemId", "workflowId"];
  const detail = keys.map((key) => args[key]).find((value) => typeof value === "string" && value.trim());
  return typeof detail === "string" ? `: ${detail}` : "";
}

export function isContentOpsMutationTool(toolName: string) {
  return MUTATION_TOOLS.has(toolName);
}

export async function createQuillActionProposal(input: {
  threadId: string;
  access: UserAccess;
  toolName: string;
  args: Record<string, unknown>;
}) {
  return prisma.quillActionProposal.create({
    data: {
      threadId: input.threadId,
      userId: input.access.id,
      toolName: input.toolName,
      arguments: toJson(input.args),
      summary: `${TOOL_LABELS[input.toolName] ?? input.toolName}${describeArguments(input.args)}`,
    },
  });
}

export async function executeQuillActionProposal(id: string, access: UserAccess) {
  if (access.role === UserRole.viewer) {
    throw new Error("Editor or admin access is required to approve Quill actions.");
  }

  const proposal = await prisma.quillActionProposal.findFirst({ where: { id, userId: access.id } });
  if (!proposal) throw new Error("Quill action proposal not found.");
  if (proposal.status !== QuillActionStatus.pending && proposal.status !== QuillActionStatus.failed) {
    throw new Error(`This Quill action is already ${proposal.status}.`);
  }

  const claimed = await prisma.quillActionProposal.updateMany({
    where: { id, status: proposal.status },
    data: { status: QuillActionStatus.executing, reviewedAt: new Date(), error: null },
  });
  if (claimed.count !== 1) throw new Error("This Quill action is already being processed.");

  try {
    const result = await executeContentOpsTool(
      proposal.toolName,
      proposal.arguments as Record<string, unknown>,
      { access },
    );
    const completed = await prisma.quillActionProposal.update({
      where: { id },
      data: { status: QuillActionStatus.completed, result: toJson(result), completedAt: new Date() },
    });
    await prisma.chatMessage.create({
      data: {
        threadId: proposal.threadId,
        role: "assistant",
        content: `Approved action completed: ${result.summary}`,
        toolName: proposal.toolName,
        toolPayload: toJson({ proposalId: proposal.id, result: result.payload }),
      },
    });
    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quill action failed.";
    await prisma.quillActionProposal.update({
      where: { id },
      data: { status: QuillActionStatus.failed, error: message },
    });
    throw new Error(message);
  }
}

export async function rejectQuillActionProposal(id: string, access: UserAccess) {
  const proposal = await prisma.quillActionProposal.findFirst({ where: { id, userId: access.id } });
  if (!proposal) throw new Error("Quill action proposal not found.");
  if (proposal.status !== QuillActionStatus.pending && proposal.status !== QuillActionStatus.failed) {
    throw new Error(`This Quill action is already ${proposal.status}.`);
  }
  const rejected = await prisma.quillActionProposal.update({
    where: { id },
    data: { status: QuillActionStatus.rejected, reviewedAt: new Date(), error: null },
  });
  await prisma.chatMessage.create({
    data: {
      threadId: proposal.threadId,
      role: "assistant",
      content: `Action rejected: ${proposal.summary}. No changes were made.`,
      toolName: proposal.toolName,
      toolPayload: toJson({ proposalId: proposal.id, status: QuillActionStatus.rejected }),
    },
  });
  return rejected;
}
