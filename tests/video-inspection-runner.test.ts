import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const m=vi.hoisted(()=>({jobs:vi.fn(),update:vi.fn(),asset:vi.fn(),brief:vi.fn(),source:vi.fn(),send:vi.fn(),create:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{mediaGenerationJob:{findMany:m.jobs,updateMany:m.update,findUniqueOrThrow:m.source},asset:{findUniqueOrThrow:m.asset},videoBrief:{findUniqueOrThrow:m.brief}}}));
vi.mock('openai',()=>({default:class{chat={completions:{create:m.create}}}}));
vi.mock('@/lib/media/private-storage',()=>({privateObjectKey:()=> 'generated/video/clip.mp4',privateStorageClient:()=>({bucket:'private',client:{send:m.send}})}));
import { runDueVideoInspections } from '@/lib/media/video-inspection-runner';
describe('selected video inspection',()=>{
  afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();});
  it('does not send anything if another worker claimed the job',async()=>{
    vi.stubEnv('OPENAI_API_KEY','test');m.jobs.mockResolvedValue([{id:'job',input:{}}]);m.update.mockResolvedValue({count:0});
    await runDueVideoInspections();expect(m.create).not.toHaveBeenCalled();
  });
  it('stops before provider access if the brief changed',async()=>{
    vi.stubEnv('OPENAI_API_KEY','test');const t=new Date('2026-01-01T00:00:00Z');
    m.jobs.mockResolvedValue([{id:'job',input:{assetId:'a',assetUpdatedAt:t.toISOString(),briefUpdatedAt:t.toISOString(),planItemId:'p',sourceJobId:'s'}}]);m.update.mockResolvedValue({count:1});
    m.asset.mockResolvedValue({id:'a',updatedAt:t});m.brief.mockResolvedValue({updatedAt:new Date('2026-01-02T00:00:00Z')});m.source.mockResolvedValue({outputAssetId:'a',status:'succeeded'});
    await runDueVideoInspections();expect(m.create).not.toHaveBeenCalled();expect(m.update.mock.calls[1][0].data.status).toBe('failed');
    expect(m.update.mock.calls[1][0].data.input.failureStage).toBe('validation');
    expect(m.update.mock.calls[1][0].data.input.providerMayHaveBeenCalled).toBe(false);
  });
  it('samples a real clip, sends bounded frames and saves only written findings',async()=>{
    vi.stubEnv('OPENAI_API_KEY','test');const t=new Date('2026-01-01T00:00:00Z'),dir=mkdtempSync(join(tmpdir(),'ixara-review-test-'));
    try{
      const file=join(dir,'clip.mp4');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=blue:s=64x96:d=1','-c:v','libx264','-y',file]);const bytes=readFileSync(file);
      m.jobs.mockResolvedValue([{id:'job',input:{assetId:'a',assetUpdatedAt:t.toISOString(),briefUpdatedAt:t.toISOString(),planItemId:'p',sourceJobId:'s',focus:'movement',shotPrompt:'run',startSeconds:0,durationSeconds:1,maxFrames:20,startRequested:true}}]);
      m.update.mockResolvedValue({count:1});m.asset.mockResolvedValue({id:'a',updatedAt:t,mediaType:'video',mimeType:'video/mp4',fileSize:bytes.length,metadata:{}});
      m.brief.mockResolvedValue({updatedAt:t});m.source.mockResolvedValue({outputAssetId:'a',status:'succeeded'});
      m.send.mockResolvedValue({ContentLength:bytes.length,Body:{transformToByteArray:async()=>bytes}});
      m.create.mockResolvedValue({choices:[{message:{content:'The frames show a blue image.'}}],usage:{total_tokens:42}});
      await runDueVideoInspections();
      expect(m.create).toHaveBeenCalledTimes(1);
      const sent=m.create.mock.calls[0][0].messages[0].content;
      expect(sent.filter((x:{type:string})=>x.type==='image_url').length).toBeGreaterThan(1);
      expect(sent.filter((x:{type:string})=>x.type==='image_url').length).toBeLessThanOrEqual(20);
      const saved=m.update.mock.calls[1][0].data;
      expect(saved.status).toBe('succeeded');expect(saved.input.result).toContain('blue image');
      expect(JSON.stringify(saved)).not.toContain('base64');
    }finally{rmSync(dir,{recursive:true,force:true});}
  },30000);
});
