import { beforeEach, describe, expect, it, vi } from "vitest";
const { state, db, retrieve } = vi.hoisted(() => {
  const state = { ready: true, changed: false, active: false, duplicate: false, updates: 0, audits: 0 };
  const character = () => ({ id: "kit", name: "Kit", brandProfileId: "brand", brandProfile: { brandName: "Kit Does Sports" }, providerCharacterId: null, updatedAt: new Date(state.changed ? "2026-01-02" : "2026-01-01") });
  const retrieve = vi.fn(async () => ({ id: "1513d91b-b1fc-481d-acd9-9813ee6e38a9", status: state.ready ? "READY" : "FAILED", name: "Kit", updatedAt: "2026-01-01", voice: { type: "custom", id: "voice-id", name: "Kit Does Sports", deleted: false } }));
  const db = { brandCharacter: { findUniqueOrThrow: vi.fn(async () => character()), findFirst: vi.fn(async () => state.duplicate ? { id: "other" } : null), update: vi.fn(async ({ data }: any) => { state.updates++; return { id: "kit", ...data }; }) }, mediaGenerationJob: { findFirst: vi.fn(async () => state.active ? { id: "active" } : null) }, contentActionLog: { create: vi.fn(async () => { state.audits++; }) }, $queryRaw: vi.fn(async () => []) };
  return { state, db, retrieve };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@runwayml/sdk", () => ({ default: class { avatars = { retrieve }; } }));
import { linkRunwayCharacterOperation } from "@/lib/mcp/link-runway-character";
const args = { characterId: "kit", avatarId: "1513d91b-b1fc-481d-acd9-9813ee6e38a9" };
const actor = { id: "user" };
describe("link existing Runway character", () => {
  beforeEach(() => { Object.assign(state, { ready: true, changed: false, active: false, duplicate: false, updates: 0, audits: 0 }); process.env.RUNWAYML_API_SECRET = "test"; vi.clearAllMocks(); });
  it("previews without writes and saves the verified custom voice on apply", async () => {
    const preview = await linkRunwayCharacterOperation.external!.preview(args, actor, "key");
    expect(state.updates).toBe(0); expect(preview.voiceId).toBe("voice-id");
    const result = await linkRunwayCharacterOperation.external!.apply(args, actor, preview);
    expect(result).toMatchObject({ status: "linked", avatarId: args.avatarId, voiceId: "voice-id", voiceType: "custom" });
    expect(state.updates).toBe(1); expect(state.audits).toBe(1);
  });
  it("rejects a failed avatar or an active creation", async () => {
    state.ready = false; await expect(linkRunwayCharacterOperation.external!.preview(args, actor, "key")).rejects.toThrow(/only ready/);
    state.ready = true; state.active = true; await expect(linkRunwayCharacterOperation.external!.preview(args, actor, "key")).rejects.toThrow(/active/);
  });
  it("rejects stale previews and duplicate avatar links", async () => {
    const preview = await linkRunwayCharacterOperation.external!.preview(args, actor, "key");
    state.changed = true; await expect(linkRunwayCharacterOperation.external!.apply(args, actor, preview)).rejects.toThrow(/changed since preview/);
    state.changed = false; state.duplicate = true; await expect(linkRunwayCharacterOperation.external!.apply(args, actor, preview)).rejects.toThrow(/already linked/);
    expect(state.updates).toBe(0);
  });
});
