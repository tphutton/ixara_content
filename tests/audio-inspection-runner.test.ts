import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({findMany:vi.fn(),updateMany:vi.fn(),create:vi.fn(),get:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{mediaGenerationJob:{findMany:mocks.findMany,updateMany:mocks.updateMany}}}));
vi.mock('openai',()=>({default:class {chat={completions:{create:mocks.create}}}}));
vi.mock('@/lib/media/private-storage',()=>({privateObjectKey:()=>null,privateStorageClient:()=>({})}));
import { runDueAudioInspections } from '@/lib/media/audio-inspection-runner';

describe('audio inspection runner',()=>{
  afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();});
  it('does nothing without an API key',async()=>{
    vi.stubEnv('OPENAI_API_KEY','');
    await runDueAudioInspections();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it('does not call the provider if another worker claimed the job',async()=>{
    vi.stubEnv('OPENAI_API_KEY','test');
    mocks.findMany.mockResolvedValue([{id:'job',input:{}}]);
    mocks.updateMany.mockResolvedValue({count:0});
    await runDueAudioInspections();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
  });
});
