import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import { validateTimeline, type Timeline } from './timeline';
const execute=promisify(execFile);
export type LocalMedia = {path:string;kind:'image'|'video'|'audio'};

export function buildRenderArgs(timeline:Timeline, media:Map<string,LocalMedia>, output:string, subtitlePath?:string) {
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
    const crop=scene.crop?`crop=iw*${scene.crop.width}:ih*${scene.crop.height}:iw*${scene.crop.x}:ih*${scene.crop.y},`:'';
    if (source.kind === 'image' && scene.motion && scene.motion !== 'none') {
      const zoom = scene.motion === 'push' ? 'min(zoom+0.0008,1.08)' : 'if(lte(on,1),1.08,max(1.0,zoom-0.0008))';
      filters.push(`[${index}:v]trim=duration=${scene.durationSeconds},setpts=PTS-STARTPTS,${crop}scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=720x1280:fps=24,format=yuv420p[v${index}]`);
    } else filters.push(`[${index}:v]trim=duration=${scene.durationSeconds},setpts=PTS-STARTPTS,${crop}scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p[v${index}]`);
  });
  timeline.audio.forEach((track,index)=>{
    const source=media.get(track.assetId);
    if(!source||source.kind!=='audio')throw new Error('An audio asset is unavailable.');
    const format=source.path.endsWith('.mp3')?'mp3':source.path.endsWith('.wav')?'wav':source.path.endsWith('.m4a')?'mov':null;
    if(!format)throw new Error('Unsupported audio format.');
    args.push('-protocol_whitelist','file,pipe');
    if(track.loop)args.push('-stream_loop','-1');
    args.push('-f',format,'-t',String(duration-(track.offsetSeconds??0)),'-i',source.path);
    const fades=(track.fadeInSeconds?`,afade=t=in:d=${track.fadeInSeconds}`:'')+(track.fadeOutSeconds?`,afade=t=out:st=${duration-(track.offsetSeconds??0)-track.fadeOutSeconds}:d=${track.fadeOutSeconds}`:'');
    filters.push(`[${timeline.scenes.length+index}:a]atrim=duration=${duration-(track.offsetSeconds??0)},asetpts=PTS-STARTPTS,volume=${track.volume??1}${fades},adelay=${Math.round((track.offsetSeconds??0)*1000)}:all=1[a${index}]`);
  });
  filters.push(timeline.scenes.map((_,index)=>`[v${index}]`).join('')+`concat=n=${timeline.scenes.length}:v=1:a=0[vout]`);
  if(timeline.captions?.length){
    if(!subtitlePath||!/^[a-zA-Z0-9_/. -]+$/.test(subtitlePath))throw new Error('A safe subtitle file path is required.');
    filters.push(`[vout]subtitles=filename='${subtitlePath}'[vcaption]`);
  }
  const labels=timeline.audio.map((_,index)=>`[a${index}]`);
  (timeline.ticks??[]).forEach((tick,index)=>{
    filters.push(`sine=frequency=1800:sample_rate=48000:duration=0.06,afade=t=out:d=0.06,volume=${tick.volume??0.3},adelay=${Math.round(tick.offsetSeconds*1000)}:all=1[tick${index}]`);
    labels.push(`[tick${index}]`);
  });
  if(labels.length)filters.push(labels.join('')+`amix=inputs=${labels.length}:duration=longest:normalize=0,apad,atrim=duration=${duration},alimiter=limit=0.95:latency=1[aout]`);
  args.push('-filter_complex',filters.join(';'),'-map',timeline.captions?.length?'[vcaption]':'[vout]');
  if(labels.length)args.push('-map','[aout]','-c:a','aac','-b:a','128k'); else args.push('-an');
  args.push('-t',String(duration),'-c:v','libx264','-threads','2','-preset','veryfast','-pix_fmt','yuv420p','-movflags','+faststart',output);
  return args;
}
export async function renderTimeline(timeline:Timeline,media:Map<string,LocalMedia>,output:string) {
  validateTimeline(timeline);
  const subtitlePath=timeline.captions?.length?output+'.ass':undefined;
  try{
    if(subtitlePath)await writeFile(subtitlePath,buildSubtitleFile(timeline));
    await execute('ffmpeg',buildRenderArgs(timeline,media,output,subtitlePath),{timeout:300000,maxBuffer:1024*1024});
  }finally{if(subtitlePath)await unlink(subtitlePath).catch(()=>{});}
}

export function buildSubtitleFile(timeline:Timeline){
  const time=(seconds:number)=>{const cs=Math.round(seconds*100);return `${Math.floor(cs/360000)}:${String(Math.floor(cs/6000)%60).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;};
  // Strip ASS override syntax. Caption text is data, never filter or styling code.
  const clean=(text:string)=>text.replace(/[\\{}]/g,'').replace(/\r?\n/g,'\\N');
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,38,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,64,64,210,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`+(timeline.captions??[]).map(c=>`Dialogue: 0,${time(c.startSeconds)},${time(c.endSeconds)},Default,,0,0,0,,${clean(c.text)}`).join('\n');
}

export async function inspectRenderedTimeline(timeline:Timeline,output:string){
  const expected=validateTimeline(timeline);
  const {stdout}=await execute('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',output],{timeout:30000,maxBuffer:1024*1024});
  const probe=JSON.parse(stdout) as {format?:{duration?:string};streams?:{codec_type:string;width?:number;height?:number}[]};
  const actual=Number(probe.format?.duration),video=probe.streams?.find(s=>s.codec_type==='video'),hasAudio=!!probe.streams?.some(s=>s.codec_type==='audio');
  if(!Number.isFinite(actual)||Math.abs(actual-expected)>0.15||video?.width!==720||video?.height!==1280||((timeline.audio.length>0||!!timeline.ticks?.length)&&!hasAudio))throw new Error('Rendered output failed technical validation.');
  return {durationSeconds:actual,width:720,height:1280,hasAudio,captionCount:timeline.captions?.length??0,tickCount:timeline.ticks?.length??0,scope:'Technical stream checks only; not editorial or continuous audiovisual review.'};
}
