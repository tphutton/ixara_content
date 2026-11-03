export type TimelineScene = {assetId:string;durationSeconds:number;startSeconds?:number;motion?:'none'|'push'|'pull'};
export type TimelineAudio = {assetId:string;offsetSeconds?:number;volume?:number};
export type Timeline = {scenes:TimelineScene[];audio:TimelineAudio[]};

export function validateTimeline(timeline:Timeline) {
  if(!Array.isArray(timeline.scenes)||timeline.scenes.length<1||timeline.scenes.length>30)throw new Error('Choose one to 30 visual scenes.');
  if(!Array.isArray(timeline.audio)||timeline.audio.length>3)throw new Error('Choose at most three audio tracks.');
  let duration=0;
  for(const scene of timeline.scenes) {
    if(!scene.assetId||!Number.isFinite(scene.durationSeconds)||scene.durationSeconds<0.5||scene.durationSeconds>30)throw new Error('Scenes must last between 0.5 and 30 seconds.');
    if(scene.startSeconds!==undefined&&(!Number.isFinite(scene.startSeconds)||scene.startSeconds<0||scene.startSeconds>600))throw new Error('Invalid scene start.');
    if(scene.motion!==undefined&&!['none','push','pull'].includes(scene.motion))throw new Error('Unsupported image motion.');
    duration+=scene.durationSeconds;
  }
  if(duration>180)throw new Error('Draft renders are limited to three minutes.');
  for(const audio of timeline.audio) {
    if(!audio.assetId||!Number.isFinite(audio.offsetSeconds??0)||(audio.offsetSeconds??0)<0||(audio.offsetSeconds??0)>duration||!Number.isFinite(audio.volume??1)||(audio.volume??1)<0||(audio.volume??1)>1)throw new Error('Invalid audio track settings.');
  }
  return duration;
}
