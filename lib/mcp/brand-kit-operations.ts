import type { Operation } from "./engine";
import { McpError } from "./engine";
import { prisma } from "@/lib/prisma";

const str = { type: "string" };
const schema = (properties: Record<string, unknown>, required: string[]) => ({ type: "object", properties, required, additionalProperties: false });
const roles = ["character", "prop", "style", "logo", "voice", "music", "other"];
const statuses = ["draft", "approved", "retired"];

// These use the same preview/apply transaction as other Content operations.
export const brandKitOperations: Operation[] = [{
  name: "add_brand_kit_reference", description: "Add an existing asset as a brand kit reference.", scope: "ixara-content:write", mutating: true,
  inputSchema: schema({ brandProfileId: str, assetId: str, role: { type: "string", enum: roles }, status: { type: "string", enum: statuses }, notes: str }, ["brandProfileId", "assetId", "role", "status"]),
  snapshot: async (args, tx) => ({ brand: await tx.brandProfile.findUniqueOrThrow({ where: { id: args.brandProfileId } }), asset: await tx.asset.findUniqueOrThrow({ where: { id: args.assetId } }), existing: await tx.brandKitReference.findMany({ where: { brandProfileId: args.brandProfileId, assetId: args.assetId }, orderBy: { id: "asc" } }) }),
  run: async (args, actor) => {
    const item = await prisma.brandKitReference.create({ data: { brandProfileId: args.brandProfileId, assetId: args.assetId, role: args.role, status: args.status, notes: args.notes?.trim() || null } });
    await prisma.contentActionLog.create({ data: { userId: actor.id, actionType: "create", targetType: "brand_kit_reference", targetId: item.id, summary: "Added brand kit reference", afterData: JSON.parse(JSON.stringify(item)), source: "ai" } });
    return item;
  },
}, {
  name: "update_brand_kit_reference", description: "Update a reference's role, approval state or usage notes.", scope: "ixara-content:write", mutating: true,
  inputSchema: schema({ id: str, role: { type: "string", enum: roles }, status: { type: "string", enum: statuses }, notes: str }, ["id"]),
  snapshot: async (args, tx) => tx.brandKitReference.findUniqueOrThrow({ where: { id: args.id } }),
  run: async (args, actor) => {
    if (args.role === undefined && args.status === undefined && args.notes === undefined) throw new McpError(400, "Provide a change.");
    const before = await prisma.brandKitReference.findUniqueOrThrow({ where: { id: args.id } });
    const item = await prisma.brandKitReference.update({ where: { id: args.id }, data: { role: args.role, status: args.status, notes: args.notes === undefined ? undefined : args.notes.trim() || null } });
    await prisma.contentActionLog.create({ data: { userId: actor.id, actionType: "update", targetType: "brand_kit_reference", targetId: item.id, summary: "Updated brand kit reference", beforeData: JSON.parse(JSON.stringify(before)), afterData: JSON.parse(JSON.stringify(item)), source: "ai" } });
    return item;
  },
}, {
  name: "remove_brand_kit_reference", description: "Remove a reference from a brand kit without deleting its asset.", scope: "ixara-content:write", mutating: true,
  inputSchema: schema({ id: str }, ["id"]),
  snapshot: async (args, tx) => tx.brandKitReference.findUniqueOrThrow({ where: { id: args.id } }),
  run: async (args, actor) => {
    const before = await prisma.brandKitReference.delete({ where: { id: args.id } });
    await prisma.contentActionLog.create({ data: { userId: actor.id, actionType: "delete", targetType: "brand_kit_reference", targetId: args.id, summary: "Removed brand kit reference; asset retained", beforeData: JSON.parse(JSON.stringify(before)), source: "ai" } });
    return { removed: true, assetId: before.assetId };
  },
}];
