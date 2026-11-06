import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({findMany:vi.fn(),updateMany:vi.fn(),create:vi.fn(),transcribe:vi.fn(),getAsset:vi.fn(),getBrief:vi.fn(),send:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{mediaGenerationJob:{findMany:mocks.findMany,updateMany:mocks.updateMany},asset:{findUniqueOrThrow:mocks.getAsset},videoBrief:{findUniqueOrThrow:mocks.getBrief}}}));
vi.mock('openai',()=>({toFile:vi.fn(async bytes=>bytes),default:class {chat={completions:{create:mocks.create}};audio={transcriptions:{create:mocks.transcribe}}}}));
vi.mock('@/lib/media/private-storage',()=>({privateObjectKey:()=> 'uploads/test.mp3',privateStorageClient:()=>({bucket:'private',client:{send:mocks.send}})}));
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
  it('sends only explicitly started, unchanged audio once and saves the returned review',async()=>{
    vi.stubEnv('OPENAI_API_KEY','test');
    const timestamp=new Date('2026-01-01T00:00:00.000Z');
    mocks.findMany.mockResolvedValue([{id:'job',input:{assetId:'asset',assetUpdatedAt:timestamp.toISOString(),planItemId:'plan',briefUpdatedAt:timestamp.toISOString(),script:'Approved script',startRequested:true}}]);
    mocks.updateMany.mockResolvedValue({count:1});
    mocks.getAsset.mockResolvedValue({updatedAt:timestamp,mediaType:'audio',mimeType:'audio/mpeg',fileSize:3,metadata:{}});
    mocks.getBrief.mockResolvedValue({updatedAt:timestamp,script:'Approved script'});
    mocks.send.mockResolvedValue({ContentLength:3,Body:{transformToByteArray:async()=>new Uint8Array([1,2,3])}});
    mocks.create.mockResolvedValue({choices:[{message:{content:'Transcript and review'}}]});
    await runDueAudioInspections();
    expect(mocks.findMany.mock.calls[0][0].where.input).toEqual({path:['startRequested'],equals:true});
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany.mock.calls[1][0].data.input.result).toBe('Transcript and review');
  });
  it('saves timestamp data without treating recognized words as approved captions',async()=>{
    vi.stubEnv('OPENAI_API_KEY','test');
    const timestamp=new Date('2026-01-01T00:00:00.000Z');
    mocks.findMany.mockResolvedValue([{id:'job',targetType:'narration_alignment',input:{assetId:'asset',assetUpdatedAt:timestamp.toISOString(),planItemId:'plan',briefUpdatedAt:timestamp.toISOString(),script:'Approved script',startRequested:true}}]);
    mocks.updateMany.mockResolvedValue({count:1});
    mocks.getAsset.mockResolvedValue({updatedAt:timestamp,mediaType:'audio',mimeType:'audio/mpeg',fileSize:3});
    mocks.getBrief.mockResolvedValue({updatedAt:timestamp,script:'Approved script'});
    mocks.send.mockResolvedValue({ContentLength:3,Body:{transformToByteArray:async()=>new Uint8Array([1,2,3])}});
    mocks.transcribe.mockResolvedValue({text:'Different script',duration:2,words:[{word:'Different',start:0,end:1},{word:'script',start:1,end:2}]});
    await runDueAudioInspections();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.transcribe).toHaveBeenCalledWith(expect.objectContaining({model:'whisper-1',response_format:'verbose_json',timestamp_granularities:['word']}));
    expect(mocks.updateMany.mock.calls[1][0].data.input).toMatchObject({script:'Approved script',transcript:'Different script',words:[{word:'Different',start:0,end:1},{word:'script',start:1,end:2}]});
  });
  it('does not call OpenAI when the script changed after preparation',async()=>{
    vi.stubEnv('OPENAI_API_KEY','test');
    const timestamp=new Date('2026-01-01T00:00:00.000Z');
    mocks.findMany.mockResolvedValue([{id:'job',input:{assetId:'asset',assetUpdatedAt:timestamp.toISOString(),planItemId:'plan',briefUpdatedAt:timestamp.toISOString(),script:'Old',startRequested:true}}]);
    mocks.updateMany.mockResolvedValue({count:1});
    mocks.getAsset.mockResolvedValue({updatedAt:timestamp});
    mocks.getBrief.mockResolvedValue({updatedAt:timestamp,script:'New'});
    await runDueAudioInspections();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateMany.mock.calls[1][0].data.status).toBe('failed');
  });
});
