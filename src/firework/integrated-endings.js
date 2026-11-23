// Candidate composition only; P0/P1 motion implementations remain unchanged.
import {createBurstCandidate,sampleBurstParticle} from './burst-candidate.js'
import {sampleHead} from './head-candidate.js'
import {paintTrailCandidate} from './trail-candidate.js'
import {stopCandidateHead} from './candidate-lifecycle.js'
import {paintParticleBrush} from './particle-brush.js'
import {paintBrushTip} from './brush-tips.js'
export function createIntegratedEndings(seed=1201){
 const base=createBurstCandidate(seed);let n=seed^0x7133;const r=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296),choose=()=>{const q=r();return q<.5?'star':q<.8?'butterfly':'flower'},events=[],particles=[]
 const slots=[0,0,0],occupied=[]
 for(const h of base.trail.head.heads){const s=base.trail.head.tail.peak.strokes[h.id],q=r();let mode=s.spec==='fine'?'natural':q<.45?'natural':q<.65?'shaped':'secondary',time=null
  for(let age=.7+(h.id%5)*.065;age<h.duration-.03;age+=.005){const p=sampleHead(h,h.birth+age);if(p.vy>8&&Math.hypot(p.vx,p.vy)<Math.hypot(h.initialVelocity.x,h.initialVelocity.y)*.75){time=h.birth+age;break}}
  if(time===null)mode='natural'
  if(mode==='secondary'){
   const p=sampleHead(h,time),slot=slots.indexOf(Math.min(...slots));if(time<slots[slot]||occupied.some(e=>Math.abs(e.time-time)<.65&&Math.hypot(e.x-p.x,e.y-p.y)<55))mode='natural'
   else{slots[slot]=time+.85;occupied.push({time,x:p.x,y:p.y})}
  }
  const e={headId:h.id,mode,time,type:choose(),size:5+r()*5,rotation:r()*3,life:.48+r()*.22};events.push(e)
  if(mode==='secondary'){
   const p=sampleHead(h,time),templates=base.particles.slice(0,19),count=12+Math.floor(r()*7)
   for(let i=0;i<count;i++){const t=templates[i],a=r()*Math.PI*2,v=22+r()*65,type=i<count-3?'ordinary':choose();particles.push({...t,eventId:h.id,type,birth:time+r()*.035,life:(type==='ordinary'?.35:.6)+r()*.42,x:p.x,y:p.y,vx:p.vx*.3+Math.cos(a)*v,vy:p.vy*.3+Math.sin(a)*v,color:h.color,size:type==='ordinary'?.3+r()*.35:4+r()*5,angle:r()*3})}
  }
 }
 // Stop emission at planned events; stopping doesn't clear existing trails.
 for(const e of events)if(e.mode==='secondary')stopCandidateHead(base.trigger.lifecycle,e.headId,e.time)
 return {seed,base,events,particles,duration:Math.max(base.trail.duration,...particles.map(p=>p.birth+p.life),...events.filter(e=>e.mode==='shaped').map(e=>e.time+e.life))+.1}
}
export function paintIntegratedEndings(ctx,c,time,{mode=null,body=true,starPainter=null,flowerPainter=null,butterflyPainter=null,continuity=true}={}){
 if(body)paintTrailCandidate(ctx,c.base.trail,time,{lifecycle:c.base.trigger.lifecycle,continuity})
 let bursts=0,shapes=0,ordinary=0
 ctx.save();ctx.globalCompositeOperation='lighter'
 for(const e of c.events){if(e.mode==='natural'||mode&&mode!==e.mode)continue;const age=time-e.time;if(e.mode==='secondary'){if(age>=0&&age<.85)bursts++;continue}if(age<0||age>=e.life)continue
  const h=c.base.trail.head.heads[e.headId],p=sampleHead(h,time),alpha=Math.min(1,age/.1)*Math.min(1,(e.life-age)/.22);ctx.globalAlpha=alpha;if(e.type==='star'&&starPainter)starPainter(ctx,`tip:${e.headId}`,p.x,p.y,e.size*Math.min(1,age/.12),Math.atan2(p.vy,p.vx)+e.rotation,h.color);else if(e.type==='butterfly'&&butterflyPainter)butterflyPainter(ctx,`tip:${e.headId}`,p.x,p.y,e.size*Math.min(1,age/.12),e.size);else if(e.type==='flower'&&flowerPainter)flowerPainter(ctx,`tip:${e.headId}`,p.x,p.y,e.size*Math.min(1,age/.12),e.size);else paintBrushTip(ctx,e.type,p.x,p.y,e.size*Math.min(1,age/.12),Math.atan2(p.vy,p.vx)+e.rotation,h.color);shapes++
 }
 for(const [particleId,p] of c.particles.entries()){if(mode&&mode!=='secondary')continue;const q=sampleBurstParticle(p,time);if(!q.visible)continue
  if(p.type==='ordinary'){ctx.globalAlpha=1;paintParticleBrush(ctx,{particles:[{...p,type:'scatter',x:q.x,y:q.y-2,vx:0,vy:0,birth:0,life:2,size:p.size*Math.sqrt(q.alpha)}]},500,{color:p.color});ordinary++}
  else{ctx.globalAlpha=q.alpha;if(p.type==='star'&&starPainter)starPainter(ctx,`burst:${particleId}`,q.x,q.y,p.size*Math.min(1,q.age/.09),p.angle+p.rotation*q.age,p.color,p);else if(p.type==='butterfly'&&butterflyPainter)butterflyPainter(ctx,`burst:${particleId}`,q.x,q.y,p.size*Math.min(1,q.age/.09),p.size);else if(p.type==='flower'&&flowerPainter)flowerPainter(ctx,`burst:${particleId}`,q.x,q.y,p.size*Math.min(1,q.age/.09),p.size);else paintBrushTip(ctx,p.type,q.x,q.y,p.size*Math.min(1,q.age/.09),p.angle+p.rotation*q.age,p.color,p);shapes++}
 }ctx.restore();return {bursts,shapes,ordinary,complete:time>=c.duration}
}
