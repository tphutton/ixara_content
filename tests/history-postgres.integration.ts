import assert from "node:assert/strict";
async function main() {
  Object.assign(process.env, { IXARA_MCP_ENABLED: "true", IXARA_MCP_WRITE_ENABLED: "true", IXARA_MCP_ADMIN_KEY: "x".repeat(40) });
  const { prisma } = await import("../lib/prisma");
  const { handleMcp } = await import("../lib/mcp/adapter");
  const call = (body: unknown) => handleMcp(new Request("https://content.test/api/external/mcp", { method: "POST", headers: { "x-ixara-mcp-key": "x".repeat(40) }, body: JSON.stringify(body) }));
  const schedule = await prisma.contentSchedule.create({ data: { status: "published", brand: "StadioMate", channel: "Instagram", scheduledFor: new Date("2026-04-05T12:00:00Z") } });
  const post = await prisma.publishedPost.create({ data: { platform: "instagram", status: "published", sourceBrandName: "StadioMate", externalPostId: "history-integration-post", importedAt: new Date(), publishedAt: new Date("2026-04-05T08:00:00Z"), titleSnapshot: "Imported history" } });
  const preview: any = await call({ action: "preview", tool: "update_schedule_entry", request_key: "history-link-integration", args: { id: schedule.id, publishedPostId: post.id } });
  assert.equal((await prisma.publishedPost.findUniqueOrThrow({ where: { id: post.id } })).scheduleId, null);
  await call({ action: "apply", change_set_id: preview.id });
  await call({ action: "apply", change_set_id: preview.id });
  assert.equal((await prisma.publishedPost.findUniqueOrThrow({ where: { id: post.id } })).scheduleId, schedule.id);
  const after = await prisma.contentSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
  assert.equal(after.status, "published");
  assert.equal(after.scheduledFor.toISOString(), schedule.scheduledFor.toISOString());
  await assert.rejects(call({ action: "preview", tool: "update_schedule_entry", request_key: "history-forbidden-edit", args: { id: schedule.id, publishedPostId: post.id, status: "cancelled" } }));
  const note: any = await call({ action: "preview", tool: "update_schedule_entry", request_key: "history-stale-evidence", args: { id: schedule.id, publishedPostId: post.id, historyNote: "Reviewed" } });
  await prisma.publishedPost.update({ where: { id: post.id }, data: { titleSnapshot: "Changed by another editor" } });
  await assert.rejects(call({ action: "apply", change_set_id: note.id }), (error: any) => error.status === 409);
  await prisma.publishedPost.delete({ where: { id: post.id } });
  await prisma.contentSchedule.delete({ where: { id: schedule.id } });
  await prisma.$disconnect();
  console.log("Published history PostgreSQL integration: preview rollback, link, idempotency, immutable status/date and stale evidence PASS");
}
main().catch((error) => { console.error(error); process.exit(1); });
