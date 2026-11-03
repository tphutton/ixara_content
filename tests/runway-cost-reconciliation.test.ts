import { beforeEach, describe, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({findMany:vi.fn(),findUniqueOrThrow:vi.fn(),update:vi.fn(),action:vi.fn(),task:vi.fn(),lock:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{mediaGenerationJob:{findMany:m.findMany,findUniqueOrThrow:m.findUniqueOrThrow,update:m.update},contentActionLog:{create:m.action},$queryRaw:m.lock}}));
vi.mock('@/lib/media/providers/runway',()=>({getRunwayTask:m.task}));
import { runwayCostReconciliation } from '../lib/mcp/runway-cost-reconciliation';
const args={planId:'plan',jobIds:['job']};
const job={id:'job',provider:'runway',status:'succeeded',externalTaskId:'task',outputAssetId:'asset',input:{planId:'plan',estimatedCredits:8}};
beforeEach(()=>{vi.clearAllMocks();m.findMany.mockResolvedValue([job]);m.findUniqueOrThrow.mockResolvedValue(job);m.task.mockResolvedValue({id:'task',status:'SUCCEEDED',cost:{credits:5}});});
describe('provider-verified reservation reconciliation',()=>{
  it('previews without changes and applies only the verified successful cost',async()=>{
    const preview:any=await runwayCostReconciliation.external!.preview(args,{},'key');expect(m.update).not.toHaveBeenCalled();
    const applied:any=await runwayCostReconciliation.external!.apply(args,{id:'actor'},preview);
    expect(applied.creditsReleased).toBe(3);expect(m.update.mock.calls[0][0].data.input).toMatchObject({estimatedCredits:5,originalEstimatedCredits:8,verifiedRunwayCredits:5});
  });
  it('never releases a failed or unsettled job',async()=>{
    m.findMany.mockResolvedValue([{...job,status:'failed'}]);await expect(runwayCostReconciliation.external!.preview(args,{},'key')).rejects.toThrow('successful');expect(m.task).not.toHaveBeenCalled();
  });
  it('rejects missing costs and costs higher than the reservation',async()=>{
    m.task.mockResolvedValue({id:'task',status:'SUCCEEDED'});await expect(runwayCostReconciliation.external!.preview(args,{},'key')).rejects.toThrow('cost');
    m.task.mockResolvedValue({id:'task',status:'SUCCEEDED',cost:{credits:9}});await expect(runwayCostReconciliation.external!.preview(args,{},'key')).rejects.toThrow('cost');
  });
  it('requires re-preview if provider cost changes',async()=>{
    const preview=await runwayCostReconciliation.external!.preview(args,{},'key');m.task.mockResolvedValue({id:'task',status:'SUCCEEDED',cost:{credits:6}});
    await expect(runwayCostReconciliation.external!.apply(args,{id:'actor'},preview)).rejects.toThrow('changed');expect(m.update).not.toHaveBeenCalled();
  });
});
