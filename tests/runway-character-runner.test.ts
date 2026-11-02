import { beforeEach, describe, expect, it, vi } from "vitest";
const { state, db, createAvatar, retrieveAvatar, loadImage } = vi.hoisted(() => {
  const state = { status: "queued", providerId: null as string | null, created: 0 };
  const createAvatar = vi.fn(async () => { state.created++; return { id: "avatar-id", status: "PROCESSING" }; });
  const retrieveAvatar = vi.fn(async () => ({ id: "avatar-id", status: "READY" }));
  const loadImage = vi.fn(async () => "data:image/png;base64,abc");
  const db = {
    brandCharacter: { findUniqueOrThrow: vi.fn(async () => ({ id: "char", name: "Kit", personality: "Curious", referenceAssetId: "asset", providerCharacterId: state.providerId, updatedAt: new Date("2026-01-01") })), update: vi.fn(async ({ data }: any) => { state.providerId = data.providerCharacterId; return {}; }) },
    mediaGenerationJob: { updateMany: vi.fn(async ({ data }: any) => { state.status = data.status; return { count: 1 }; }), findUniqueOrThrow: vi.fn(async () => ({ id: "job", status: state.status })), update: vi.fn(async ({ data }: any) => { state.status = data.status; return { id: "job", status: state.status }; }) },
    $transaction: vi.fn(async (fn: any) => fn(db)),
  }; return { state, db, createAvatar, retrieveAvatar, loadImage };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/media/brand-reference", () => ({ loadApprovedBrandImage: loadImage }));
vi.mock("@runwayml/sdk", () => ({ default: class { avatars = { create: createAvatar, retrieve: retrieveAvatar }; } }));
import { processRunwayCharacterJob } from "@/lib/media/runway-character-runner";
const input = { startRequested: true, characterUpdatedAt: "2026-01-01T00:00:00.000Z", referenceAssetId: "asset", brandKitReferenceId: "ref", voicePreset: "clara" };
const job = { id: "job", targetType: "brand_character", targetId: "char", status: "queued" as const, externalTaskId: null, outputUrl: null, input };
describe("Runway character worker", () => {
  beforeEach(() => { vi.clearAllMocks(); state.status = "queued"; state.providerId = null; state.created = 0; process.env.RUNWAYML_API_SECRET = "test-key"; });
  it("will not call the provider without an explicit start", async () => {
    await expect(processRunwayCharacterJob({ ...job, input: { ...input, startRequested: false } })).rejects.toThrow(/explicit start/);
    expect(createAvatar).not.toHaveBeenCalled();
  });
  it("claims before creating, then links only after the avatar is ready", async () => {
    await processRunwayCharacterJob(job);
    expect(createAvatar).toHaveBeenCalledOnce();
    expect(state.providerId).toBeNull();
    await processRunwayCharacterJob({ ...job, status: "running", externalTaskId: "avatar-id" });
    expect(retrieveAvatar).toHaveBeenCalledOnce();
    expect(state.providerId).toBe("avatar-id");
    expect(state.status).toBe("succeeded");
  });
  it("will not create again for an unresolved submission", async () => {
    await processRunwayCharacterJob({ ...job, status: "submitted" });
    expect(createAvatar).not.toHaveBeenCalled();
  });
});
