import{coreActiveCount}from'./main-core.js'
import {createLiveFirework,paintLiveFirework,disposeLiveFirework} from './live-particles.js'
import {createGroupScheduler} from './group-composition.js'
import {sampleHead} from './head-candidate.js'
import { visibleVideoRect,projectPoints,videoFit } from '../projection.js'

// One RAF-driven scheduler: no timers, queued bursts or catch-up loops.
export function createBurstScheduler(trigger, interval = 1300) {
 let next, last = -Infinity, stopped = false
 return {
  stopScheduling() { next = undefined; stopped = true },
  step(snapshot, now, enabled = true) {
   if (!enabled || !snapshot.faceDetected || snapshot.state !== 'LAUGH' || now-snapshot.timestamp > 750) {
    next = undefined; stopped = false; return
   }
   if (stopped) return
   next ??= Math.max(now, last+interval)
   if (now < next) return
   trigger({source:'laugh'})
   last = now; next = now+interval
  },
 }
}

export function mountFirework(expressions) {
 const room=document.querySelector('.live-room'),video=room.querySelector('video')
 const canvas=document.createElement('canvas');canvas.width=414;canvas.height=896
 canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4'
 canvas.setAttribute('aria-hidden','true');canvas.dataset.renderer='live-particles';room.querySelector('.live-stage').append(canvas)
 const ctx=canvas.getContext('2d');let active=[], count=0, raf, disposed=false
 const paletteOffset = Math.floor(Math.random()*4)
 const live = now => active.filter(item=>now-item.start<item.particles.duration)
 const prune = now => {for(const item of active)if(now-item.start>=item.particles.duration)disposeLiveFirework(item.particles);active=live(now)}
 let faceLandmarks=null,faceTime=-Infinity
 const context=()=>{const bounds=visibleVideoRect(video,room,414,896);let face=null;if(faceLandmarks&&performance.now()-faceTime<750){const vr=video.getBoundingClientRect(),rr=room.getBoundingClientRect();if(vr.width&&rr.width){const points=projectPoints(faceLandmarks,vr.width,vr.height,video.videoWidth||vr.width,video.videoHeight||vr.height,videoFit(video)),xs=points.map(p=>(vr.x-rr.x+p.x)*414/rr.width),ys=points.map(p=>(vr.y-rr.y+p.y)*896/rr.height);face={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}}}return{bounds,face,seed:count+paletteOffset}}
 const load=()=>{let particles=0,peakMains=0,reservedParticles=0;const now=performance.now();for(const item of active){const age=(now-item.start)/1000,c=item.particles.state.candidate.body;reservedParticles+=item.particles.particleReservation;particles+=coreActiveCount(item.particles.core,age);if(item.role==='main'&&age<.95)peakMains++;particles+=c.base.trail.head.heads.filter(h=>sampleHead(h,age).visible).length;particles+=c.base.trail.particles.filter(p=>age>=p.birth&&age<p.birth+p.life).length;particles+=c.particles.filter(p=>age>=p.birth&&age<p.birth+p.life).length}return{instances:live(now).length,particles,peakMains,reservedParticles}}
 const scheduler=createGroupScheduler({load,spawn(item,now){if(disposed)return false;const particles=createLiveFirework(item.seed,{role:item.role});if(load().reservedParticles+particles.particleReservation>scheduler.config.particleBudget){disposeLiveFirework(particles);return false}active.push({...item,particles,start:now});return true}})
 const controller={
  get playing(){return live(performance.now()).length>0},
  get activeCount(){return live(performance.now()).length},
  updateFace(points){faceLandmarks=points?.length?points:null;faceTime=performance.now()},
  stopScheduling(){scheduler.stopScheduling()},
  dispose(){disposed=true;cancelAnimationFrame(raf);scheduler.dispose();for(const item of active)disposeLiveFirework(item.particles);active=[];button.remove();canvas.remove();document.removeEventListener('visibilitychange',visibility)},
  trigger({position,source='manual',seed=count+paletteOffset}={}){if(disposed||document.hidden)return false;prune(performance.now());const c={...context(),position,seed};if(!c.bounds.width||!c.bounds.height)return false;const accepted=scheduler.trigger(performance.now(),c,source);if(accepted){count++;canvas.dataset.triggerCount=String(scheduler.stats.groups);canvas.dataset.source=source;canvas.dataset.groupHistory=JSON.stringify(scheduler.stats.history)}return accepted}
 }
 const visibility=()=>{if(document.hidden)scheduler.stopScheduling();else scheduler.step(expressions.snapshot,performance.now(),context(),false)}
 document.addEventListener('visibilitychange',visibility)
 const button=document.createElement('button');button.type='button';button.textContent='测试烟花（占位）'
 button.onclick=()=>controller.trigger({source:'manual'})
 document.querySelector('#visual-rain [data-play]').parentElement.append(button)
 function tick(now){
  if(disposed)return
  prune(now)
  const enabled=!document.hidden && Boolean(video.srcObject?.getVideoTracks().some(track=>track.readyState==='live'))
  const before=scheduler.stats.groups;scheduler.step(expressions.snapshot,now,context(),enabled);if(scheduler.stats.groups>before){count++;canvas.dataset.triggerCount=String(scheduler.stats.groups);canvas.dataset.source='laugh';canvas.dataset.groupHistory=JSON.stringify(scheduler.stats.history)}
  const dpr=window.devicePixelRatio||1,frame=room.getBoundingClientRect(),w=Math.max(1,Math.round(frame.width*dpr)),h=Math.max(1,Math.round(frame.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}ctx.setTransform(canvas.width/414,0,0,canvas.height/896,0,0);ctx.clearRect(0,0,414,896)
  for(const item of active) paintLiveFirework(ctx,item.particles,now-item.start,item.position,visibleVideoRect(video,room,414,896),item.scale)
  canvas.dataset.activeCount=String(active.length);canvas.dataset.groupCount=String(scheduler.stats.groups);canvas.dataset.pendingCount=String(scheduler.pendingCount);const census=load();canvas.dataset.peakMains=String(census.peakMains);canvas.dataset.activeParticles=String(census.particles);canvas.dataset.reservedParticles=String(census.reservedParticles);canvas.dataset.skippedSupports=String(scheduler.stats.skippedSupports)
  raf=requestAnimationFrame(tick)
 }
 raf=requestAnimationFrame(tick)
 window.addEventListener('pagehide',()=>controller.dispose(),{once:true})
 return controller
}
