import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateTimeline, type Timeline } from './timeline';
const execute=promisify(execFile);
export type LocalMedia = {path:string;kind:'image'|'video'|'audio'};

export function buildRenderArgs(timeline:Timeline, media:Map<string,LocalMedia>, output:string) {
  const duration=validateTimeline(timeline);
  const args=['-nostdin','-y','-hide_banner','-loglevel','error','-filter_complex_threads','2'];
  const filters:string[]=[];
  timeline.scenes.forEach((scene,index)=>{
    const source=media.get(scene.assetId);
    if(!source||!['image','video'].includes(source.kind))throw new Error('A visual asset is unavailable.');
    args.push('-protocol_whitelist','file,pipe');
    if(source.kind==='image')args.push('-f','image2','-loop','1'); else args.push('-f','mov','-stream_loop','-1');
    if(scene.startSeconds)args.push('-ss',String(scene.startSeconds));
    args.push('-t',String(scene.durationSeconds),'-i',source.path);
    if (source.kind === 'image' && scene.motion && scene.motion !== 'none') {
      const zoom = scene.motion === 'push' ? 'min(zoom+0.0008,1.08)' : 'if(lte(on,1),1.08,max(1.0,zoom-0.0008))';
      filters.push(`[${index}:v]trim=duration=${scene.durationSeconds},setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=720x1280:fps=24,format=yuv420p[v${index}]`);
    } else filters.push(`[${index}:v]trim=duration=${scene.durationSeconds},setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p[v${index}]`);
  });
  timeline.audio.forEach((track,index)=>{
    const source=media.get(track.assetId);
    if(!source||source.kind!=='audio')throw new Error('An audio asset is unavailable.');
    const format=source.path.endsWith('.mp3')?'mp3':source.path.endsWith('.wav')?'wav':source.path.endsWith('.m4a')?'mov':null;
    if(!format)throw new Error('Unsupported audio format.');
    args.push('-protocol_whitelist','file,pipe','-f',format,'-i',source.path);
    filters.push(`[${timeline.scenes.length+index}:a]volume=${track.volume??1},adelay=${Math.round((track.offsetSeconds??0)*1000)}:all=1[a${index}]`);
  });
  filters.push(timeline.scenes.map((_,index)=>`[v${index}]`).join('')+`concat=n=${timeline.scenes.length}:v=1:a=0[vout]`);
  if(timeline.audio.length)filters.push(timeline.audio.map((_,index)=>`[a${index}]`).join('')+`amix=inputs=${timeline.audio.length}:duration=longest:normalize=0,atrim=duration=${duration}[aout]`);
  args.push('-filter_complex',filters.join(';'),'-map','[vout]');
  if(timeline.audio.length)args.push('-map','[aout]','-c:a','aac','-b:a','128k'); else args.push('-an');
  args.push('-t',String(duration),'-c:v','libx264','-threads','2','-preset','veryfast','-pix_fmt','yuv420p','-movflags','+faststart',output);
  return args;
}
export async function renderTimeline(timeline:Timeline,media:Map<string,LocalMedia>,output:string) {
  await execute('ffmpeg',buildRenderArgs(timeline,media,output),{timeout:300000,maxBuffer:1024*1024});
}
