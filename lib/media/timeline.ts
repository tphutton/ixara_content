export type TimelineScene = {assetId:string;shotId?:string;durationSeconds:number;startSeconds?:number;motion?:'none'|'push'|'pull';crop?:{x:number;y:number;width:number;height:number}};
export type TimelineAudio = {assetId:string;role?:'narration'|'music'|'effects';offsetSeconds?:number;volume?:number;loop?:boolean;fadeInSeconds?:number;fadeOutSeconds?:number};
export type TimelineCaption = {startSeconds:number;endSeconds:number;text:string};
export type Timeline = {delivery?:'workprint'|'full_draft';scenes:TimelineScene[];audio:TimelineAudio[];captions?:TimelineCaption[];ticks?:{offsetSeconds:number;volume?:number}[]};

export function validateTimeline(timeline:Timeline) {
  if(timeline.delivery!==undefined&&!['workprint','full_draft'].includes(timeline.delivery))throw new Error('Invalid delivery type.');
  if(!Array.isArray(timeline.scenes)||timeline.scenes.length<1||timeline.scenes.length>30)throw new Error('Choose one to 30 visual scenes.');
  if(!Array.isArray(timeline.audio)||timeline.audio.length>3)throw new Error('Choose at most three audio tracks.');
  let duration=0;
  for(const scene of timeline.scenes) {
    if(!scene.assetId||!Number.isFinite(scene.durationSeconds)||scene.durationSeconds<0.5||scene.durationSeconds>30)throw new Error('Scenes must last between 0.5 and 30 seconds.');
    if(scene.startSeconds!==undefined&&(!Number.isFinite(scene.startSeconds)||scene.startSeconds<0||scene.startSeconds>600))throw new Error('Invalid scene start.');
    if(scene.motion!==undefined&&!['none','push','pull'].includes(scene.motion))throw new Error('Unsupported image motion.');
    if(scene.crop){
      const {x,y,width,height}=scene.crop;
      if(![x,y,width,height].every(Number.isFinite)||x<0||y<0||width<=0||height<=0||x+width>1||y+height>1)throw new Error('Crop must fit within normalized source bounds.');
    }
    duration+=scene.durationSeconds;
  }
  if(duration>180)throw new Error('Draft renders are limited to three minutes.');
  for(const audio of timeline.audio) {
    if(!audio.assetId||!Number.isFinite(audio.offsetSeconds??0)||(audio.offsetSeconds??0)<0||(audio.offsetSeconds??0)>duration||!Number.isFinite(audio.volume??1)||(audio.volume??1)<0||(audio.volume??1)>1)throw new Error('Invalid audio track settings.');
  }
  for(const track of timeline.audio){
    if(track.role!==undefined&&!['narration','music','effects'].includes(track.role))throw new Error('Invalid audio role.');
    if(track.loop!==undefined&&typeof track.loop!=='boolean')throw new Error('Invalid audio loop.');
    for(const fade of [track.fadeInSeconds,track.fadeOutSeconds])if(fade!==undefined&&(!Number.isFinite(fade)||fade<0||fade>duration-(track.offsetSeconds??0)))throw new Error('Invalid audio fade.');
  }
  if(timeline.captions!==undefined){
    if(!Array.isArray(timeline.captions)||timeline.captions.length>300)throw new Error('Use at most 300 captions.');
    let previousEnd=0;
    for(const caption of timeline.captions){
      if(!Number.isFinite(caption.startSeconds)||!Number.isFinite(caption.endSeconds)||caption.startSeconds<previousEnd||caption.endSeconds<=caption.startSeconds||caption.endSeconds>duration||typeof caption.text!=='string'||!caption.text.trim()||caption.text.length>160||/[\x00-\x08\x0b-\x1f]/.test(caption.text))throw new Error('Captions must be ordered, non-overlapping and within the video.');
      previousEnd=caption.endSeconds;
    }
  }
  if(timeline.ticks!==undefined){
    if(!Array.isArray(timeline.ticks)||timeline.ticks.length>180)throw new Error('Use at most 180 stopwatch ticks.');
    for(const tick of timeline.ticks)if(!Number.isFinite(tick.offsetSeconds)||tick.offsetSeconds<0||tick.offsetSeconds+0.06>duration||!Number.isFinite(tick.volume??0.3)||(tick.volume??0.3)<0||(tick.volume??0.3)>1)throw new Error('Invalid stopwatch tick.');
  }
  return duration;
}

export function validateFullDraftCoverage(timeline:Timeline,shots:{id:string}[],requiresNarration:boolean){
  validateTimeline(timeline);
  if(timeline.delivery!=='full_draft')return;
  const ids=new Set(shots.map(shot=>shot.id));
  if(!ids.size||timeline.scenes.some(scene=>!scene.shotId||!ids.has(scene.shotId)))throw new Error('Every full-draft scene must map to a storyboard shot.');
  const covered=new Set(timeline.scenes.map(scene=>scene.shotId));
  if(shots.some(shot=>!covered.has(shot.id)))throw new Error('The full draft is missing storyboard coverage.');
  if(!timeline.audio.length)throw new Error('A full draft requires a selected sound track.');
  if(requiresNarration&&timeline.audio.filter(track=>track.role==='narration').length!==1)throw new Error('Select exactly one narration track for this voiced script.');
}
