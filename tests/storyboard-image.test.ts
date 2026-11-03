import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ videoBrief: { findUniqueOrThrow: vi.fn() }, contentPlan: { findUniqueOrThrow: vi.fn() }, mediaGenerationJob: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() }, brandKitReference: { findFirst: vi.fn() }, contentActionLog: { create: vi.fn() }, $queryRaw: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
import { imageProductionOperations } from '../lib/mcp/image-production-operations';
const queue = imageProductionOperations[0];
const args = {planItemId:'item',shotId:'shot',prompt:'A dusty road',maxCredits:8};
beforeEach(() => {
  vi.clearAllMocks();
  db.videoBrief.findUniqueOrThrow.mockResolvedValue({aspectRatio:'9:16',shots:[{id:'shot',status:'planned',updatedAt:new Date('2026-01-01T00:00:00Z'),title:'Road'}],planItem:{title:'Pilot',brand:'Kit',plan:{id:'plan',brand:'Kit'}}});
  db.contentPlan.findUniqueOrThrow.mockResolvedValue({mediaCreditBudget:20});
  db.mediaGenerationJob.findMany.mockResolvedValue([]); db.mediaGenerationJob.findFirst.mockResolvedValue(null);
  db.mediaGenerationJob.create.mockResolvedValue({id:'job',status:'queued'});
});
describe('storyboard image reservation', () => {
  it('queues only and reserves the requested upper estimate', async () => {
    const result = await queue.run(args,{id:'actor'});
    expect(result).toMatchObject({id:'job',estimatedCredits:8,status:'queued'});
    expect(db.mediaGenerationJob.create.mock.calls[0][0].data.input).toMatchObject({planId:'plan',ratio:'720:1280',estimatedCredits:8});
  });
  it('rejects a reservation over budget, including prior jobs', async () => {
    db.mediaGenerationJob.findMany.mockResolvedValue([{input:{estimatedCredits:15}}]);
    await expect(queue.run(args,{id:'actor'})).rejects.toThrow('budget');
    expect(db.mediaGenerationJob.create).not.toHaveBeenCalled();
  });
  it('rejects references not approved in this brand kit', async () => {
    db.brandKitReference.findFirst.mockResolvedValue(null);
    await expect(queue.run({...args,referenceAssetId:'asset'},{id:'actor'})).rejects.toThrow('approved');
    expect(db.mediaGenerationJob.create).not.toHaveBeenCalled();
  });
});
