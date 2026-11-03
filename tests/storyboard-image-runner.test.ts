import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({create:vi.fn(), retrieve:vi.fn(), claim:vi.fn(), update:vi.fn(), findShot:vi.fn(), persist:vi.fn()}));
vi.mock('@runwayml/sdk', () => ({default:class {textToImage={create:mocks.create};tasks={retrieve:mocks.retrieve};}, TaskFailedError:class extends Error {}, TaskTimedOutError:class extends Error {}}));
vi.mock('@/lib/prisma', () => ({prisma:{ $transaction:async (fn:any)=>fn({$queryRaw:vi.fn(),videoShot:{findUniqueOrThrow:mocks.findShot},mediaGenerationJob:{updateMany:mocks.claim}}),mediaGenerationJob:{updateMany:mocks.claim,update:mocks.update,findUniqueOrThrow:vi.fn()} }}));
vi.mock('@/lib/media/brand-reference', () => ({loadApprovedBrandImage:vi.fn()}));
import { processRunwayImageJob } from '../lib/media/runway-image-runner';
const input={startRequested:true,prompt:'A race road',ratio:'720:1280',shotId:'shot',shotUpdatedAt:'2026-01-01T00:00:00.000Z'};
const job={id:'job',targetId:'shot',targetType:'storyboard_image',status:'queued',externalTaskId:null,outputUrl:null,input};
beforeEach(()=>{vi.clearAllMocks();mocks.findShot.mockResolvedValue({status:'planned',updatedAt:new Date(input.shotUpdatedAt)});mocks.claim.mockResolvedValue({count:1});mocks.update.mockResolvedValue({...job,status:'awaiting_asset',outputUrl:'https://provider.invalid/result.png'});mocks.persist.mockResolvedValue({id:'asset'});});
describe('image submission',()=>{
  it('claims once, records provider task and persists the completed output',async()=>{
    const request:any=Promise.resolve({id:'task'});request.waitForTaskOutput=()=>Promise.resolve({output:['https://provider.invalid/result.png']});mocks.create.mockReturnValue(request);
    await expect(processRunwayImageJob(job,mocks.persist)).resolves.toEqual({id:'asset'});
    expect(mocks.create).toHaveBeenCalledOnce();expect(mocks.claim).toHaveBeenCalledTimes(2);expect(mocks.persist).toHaveBeenCalledOnce();
  });
  it('never submits a changed storyboard',async()=>{
    mocks.findShot.mockResolvedValue({status:'planned',updatedAt:new Date('2026-01-02T00:00:00Z')});
    await expect(processRunwayImageJob(job,mocks.persist)).rejects.toThrow('Storyboard changed');expect(mocks.create).not.toHaveBeenCalled();
  });
});
