// Run only against the disposable PostgreSQL CI database.
import assert from "node:assert/strict";
async function main() {
  Object.assign(process.env, { IXARA_MCP_ENABLED: "true", IXARA_MCP_WRITE_ENABLED: "true", IXARA_MCP_ADMIN_KEY: "x".repeat(40) });
  const { prisma } = await import("../lib/prisma");
  const { queueVideoGeneration } = await import("../lib/media/generation-jobs");
  const { handleMcp } = await import("../lib/mcp/adapter");
  const user = await prisma.userAccess.create({ data: { clerkUserId: "test-runway-budget", email: "runway-budget@example.invalid", role: "editor", approvalStatus: "approved" } });
  const brand = await prisma.brandProfile.create({ data: { brandName: "Runway integration brand", preferredWebsites: [], sports: [], regions: [], countries: [], bannedPhrases: [], preferredCTAs: [] } });
  const asset = await prisma.asset.create({ data: { source: "manual", title: "reference", fileUrl: "/test-runway-reference.png", mimeType: "image/png", tags: [], metadata: { storage: "private-s3", objectKey: "uploads/example.png" } } });
  await prisma.brandKitReference.create({ data: { brandProfileId: brand.id, assetId: asset.id, role: "style", status: "approved" } });
  const plan = await prisma.contentPlan.create({ data: { title: "Runway budget test", brand: brand.brandName, mediaCreditBudget: 60 } });
  const item = await prisma.contentPlanItem.create({ data: { planId: plan.id, itemType: "video", title: "test" } });
  const brief = await prisma.videoBrief.create({ data: { planItemId: item.id, durationSeconds: 15, aspectRatio: "9:16", concept: "test" } });
  const shots = await Promise.all([0, 1, 2].map(sortOrder => prisma.videoShot.create({ data: { videoBriefId: brief.id, sortOrder, title: `Shot ${sortOrder}`, durationSeconds: 5, prompt: "A scene", status: "approved" } })));
  const make = (shotId: string) => ({ accessId: user.id, planItemId: item.id, shotId, referenceAssetId: asset.id, maxCredits: 60 });
  const results = await Promise.allSettled([queueVideoGeneration(make(shots[0].id)), queueVideoGeneration(make(shots[1].id))]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1, "concurrent reservations must not exceed budget");
  assert.equal(await prisma.mediaGenerationJob.count({ where: { targetId: { in: shots.map(shot => shot.id) } } }), 1);
  await prisma.contentPlan.update({ where: { id: plan.id }, data: { mediaCreditBudget: 120 } });
  const call = (body: unknown) => handleMcp(new Request("https://content.test/api/external/mcp", { method: "POST", headers: { "x-ixara-mcp-key": "x".repeat(40) }, body: JSON.stringify(body) }));
  const preview: any = await call({ action: "preview", tool: "queue_video_generation", request_key: "runway-integration-queue", args: { planItemId: item.id, shotId: shots[2].id, referenceAssetId: asset.id, maxCredits: 60 } });
  assert.equal(await prisma.mediaGenerationJob.count({ where: { targetId: shots[2].id } }), 0, "preview must not queue or spend");
  const applied: any = await call({ action: "apply", change_set_id: preview.id });
  assert.equal(applied.applied, true);
  await call({ action: "apply", change_set_id: preview.id });
  assert.equal(await prisma.mediaGenerationJob.count({ where: { targetId: shots[2].id } }), 1, "apply retry must not duplicate a job");
  await prisma.$disconnect();
  console.log("Runway PostgreSQL integration: concurrent budget, preview rollback and idempotent apply PASS");
}
main().catch(error => { console.error(error); process.exit(1); });
