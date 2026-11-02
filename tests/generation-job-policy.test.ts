import { beforeEach, describe, expect, it, vi } from "vitest";
const { state, db } = vi.hoisted(() => {
  const state = { status: "approved", referenceStatus: "approved", duration: 5, created: 0, budget: 100, reserved: 0 };
  const db = {
    videoBrief: { findUniqueOrThrow: vi.fn(async () => ({ id: "brief", aspectRatio: "9:16", targetPlatforms: [], planItem: { title: "Pilot", brand: "Kit", plan: { id: "plan1", brand: "Kit" } }, shots: [{ id: "shot", status: state.status, durationSeconds: state.duration, prompt: "Watch ticking" }] })) },
    brandKitReference: { findFirst: vi.fn(async () => state.referenceStatus === "approved" ? ({ id: "ref", assetId: "asset", asset: { mimeType: "image/png", fileSize: 100, metadata: { storage: "private-s3", objectKey: "uploads/example.png" } }, brandProfile: { visualGuidelines: "Bright" } }) : null) },
    contentPlan: { findUniqueOrThrow: vi.fn(async () => ({ mediaCreditBudget: state.budget })) },
    mediaGenerationJob: { findMany: vi.fn(async () => state.reserved ? [{ input: { estimatedCredits: state.reserved } }] : []), findFirst: vi.fn(async () => null), create: vi.fn(async ({ data }: { data: object }) => { state.created++; return { id: "job", ...data }; }) },
    contentActionLog: { create: vi.fn(async () => ({})) },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  }; return { state, db };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { queueVideoGeneration } from "@/lib/media/generation-jobs";
const input = { accessId: "user", planItemId: "plan", shotId: "shot", referenceAssetId: "asset", maxCredits: 60 };
describe("generation queue policy", () => {
  beforeEach(() => { state.status = "approved"; state.referenceStatus = "approved"; state.duration = 5; state.created = 0; state.budget = 100; state.reserved = 0; });
  it("queues an approved shot with a matching approved image within budget", async () => { await queueVideoGeneration(input); expect(state.created).toBe(1); });
  it("rejects unapproved images and shots", async () => { state.referenceStatus = "draft"; await expect(queueVideoGeneration(input)).rejects.toThrow(/approved PNG/); state.referenceStatus = "approved"; state.status = "planned"; await expect(queueVideoGeneration(input)).rejects.toThrow(/approved individual shot/); expect(state.created).toBe(0); });
  it("allows multiple references for Seedance Mini with its own rate", async () => {
    state.budget = 200;
    await queueVideoGeneration({ ...input, model: "seedance2_mini", additionalReferenceAssetIds: ["asset2"], maxCredits: 75 });
    expect(state.created).toBe(1);
    await expect(queueVideoGeneration({ ...input, additionalReferenceAssetIds: ["asset2"] })).rejects.toThrow(/one first frame/);
  });
  it("blocks plan overspend including existing reservations", async () => { state.reserved = 50; await expect(queueVideoGeneration(input)).rejects.toThrow(/budget exceeded/); expect(state.created).toBe(0); });
  it("rejects overspending and unsupported durations", async () => { await expect(queueVideoGeneration({ ...input, maxCredits: 59 })).rejects.toThrow(/limit/); state.duration = 11; await expect(queueVideoGeneration(input)).rejects.toThrow(/2–10/); expect(state.created).toBe(0); });
});
