import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({queue:vi.fn(),start:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{}}));
vi.mock('@/lib/media/generation-jobs',()=>({queueVideoGeneration:mocks.queue}));
vi.mock('@/lib/mcp/runway-start-operation',()=>({runwayStartOperations:[{run:mocks.start}]}));
import { queueVideoBatch, videoBatchOperations } from '@/lib/mcp/video-batch-operations';
const shot=(id:string)=>({shotId:id,referenceAssetId:'asset',model:'gen4.5' as const,maxCredits:60});
describe('video batch safeguards',()=>{
  afterEach(()=>vi.resetAllMocks());
  it('rejects duplicate shots before queueing',async()=>{
    await expect(queueVideoBatch('plan',[shot('a'),shot('a')],'owner')).rejects.toThrow();
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('queues each shot without requesting a start',async()=>{
    mocks.queue.mockResolvedValue({id:'job',targetId:'shot',status:'queued',input:{estimatedCredits:60}});
    const result=await queueVideoBatch('plan',[shot('a'),shot('b')],'owner');
    expect(mocks.queue).toHaveBeenCalledTimes(2);
    expect(mocks.start).not.toHaveBeenCalled();
    expect(result.jobs[0].estimatedCredits).toBe(60);
  });
  it('rejects duplicate jobs before requesting any start',async()=>{
    const start=videoBatchOperations.find(x=>x.name==='start_video_batch')!;
    await expect(start.run({jobIds:['a','a']},{id:'owner'})).rejects.toThrow();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
