import { describe, expect, it } from 'vitest';
import { validateTimeline } from '@/lib/media/timeline';
import { buildRenderArgs, renderTimeline } from '@/lib/media/timeline-render';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
describe('draft timeline limits',()=>{
  it('computes duration and permits separately mixed audio',()=>expect(validateTimeline({scenes:[{assetId:'a',durationSeconds:5},{assetId:'b',durationSeconds:10}],audio:[{assetId:'voice'},{assetId:'tick',offsetSeconds:2,volume:0.2}]})).toBe(15));
  it('rejects excessive length, invalid offsets and invalid gain',()=>{
    expect(()=>validateTimeline({scenes:Array.from({length:7},()=>({assetId:'a',durationSeconds:30})),audio:[]})).toThrow();
    expect(()=>validateTimeline({scenes:[{assetId:'a',durationSeconds:5}],audio:[{assetId:'v',offsetSeconds:6}]})).toThrow();
    expect(()=>validateTimeline({scenes:[{assetId:'a',durationSeconds:5}],audio:[{assetId:'v',volume:2}]})).toThrow();
  });
  it('limits input protocols and builds a single mixed output',()=>{
    const args=buildRenderArgs({scenes:[{assetId:'a',durationSeconds:5}],audio:[{assetId:'voice',volume:0.8}]},new Map([['a',{path:'/tmp/a.mp4',kind:'video'}],['voice',{path:'/tmp/v.mp3',kind:'audio'}]]),'/tmp/output.mp4');
    expect(args).toContain('file,pipe');
    expect(args.join(' ')).toContain('amix=inputs=1');
    expect(args.at(-1)).toBe('/tmp/output.mp4');
  });
  it('renders a short private draft from local video and audio',async()=>{
    const dir=mkdtempSync(join(tmpdir(),'ixara-test-'));
    try{
      const video=join(dir,'source.mp4'),still=join(dir,'still.png'),audio=join(dir,'voice.wav'),output=join(dir,'draft.mp4');
      execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=blue:s=64x96:d=1','-c:v','libx264','-y',video]);
      execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=red:s=64x96:d=1','-frames:v','1','-threads','1','-y',still]);
      execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=1','-y',audio]);
      await renderTimeline({scenes:[{assetId:'scene',durationSeconds:1},{assetId:'still',durationSeconds:1}],audio:[{assetId:'voice'}]},new Map([['scene',{path:video,kind:'video'}],['still',{path:still,kind:'image'}],['voice',{path:audio,kind:'audio'}]]),output);
      expect(statSync(output).size).toBeGreaterThan(1000);
      const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type','-of','json',output],{encoding:'utf8'}));
      expect(Number(probe.format.duration)).toBeCloseTo(2,1);
      expect(probe.streams.map((stream:{codec_type:string})=>stream.codec_type)).toEqual(expect.arrayContaining(['video','audio']));
    }finally{rmSync(dir,{recursive:true,force:true});}
  },30000);
});
