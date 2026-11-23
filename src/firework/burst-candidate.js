// P1-2: independent children from immutable P1-1 trigger plans.
import {createTrailCandidate,trailPosition,paintTrailCandidate} from './trail-candidate.js'
import {createSecondaryTrigger,updateSecondaryTrigger} from './secondary-trigger.js'
import {paintParticleBrush} from './particle-brush.js'
import {paintBrushTip} from './brush-tips.js'
export function createBurstCandidate(seed=1201){
 const trail=createTrailCandidate(seed),trigger=createSecondaryTrigger(trail),particles=[];let n=seed^0x5172;const r=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)
 for(const e of trigger.plans)for(let i=0;i<19;i++){
  const type=i<15?'ordinary':['star','star','butterfly','flower'][i-15],angle=r()*Math.PI*2,speed=22+r()*65
  particles.push({eventId:e.headId,type,birth:e.time+r()*.035,life:(type==='ordinary'?.35:.6)+r()*.42,x:e.position.x,y:e.position.y,vx:e.velocity.x*.3+Math.cos(angle)*speed,vy:e.velocity.y*.3+Math.sin(angle)*speed,gravity:32+r()*40,drag:1.4+r()*1.2,color:e.color,size:type==='ordinary'?.3+r()*.35:4+r()*5,angle:r()*Math.PI,rotation:(r()-.5)*.8,hollow:r()<.2,projection:.75+r()*.25,shape:i%3,brightness:.5+r()*.4,stretch:1+r()*.6})
 }
 return {trail,trigger,particles,duration:Math.max(trail.duration,...particles.map(p=>p.birth+p.life))+.1}
}
export function sampleBurstParticle(p,time){const age=time-p.birth,pos=trailPosition(p,time);return {...pos,age,visible:time>=p.birth&&time<p.birth+p.life,alpha:age<0||age>=p.life?0:Math.min(1,age/.055)*Math.pow(1-age/p.life,.8)}}
export function paintBurstCandidate(ctx,c,time,{ordinaryOnly=false,shapesOnly=false,body=false,eventId=null}={}){
 updateSecondaryTrigger(c.trigger,time);if(body)paintTrailCandidate(ctx,c.trail,time,{lifecycle:c.trigger.lifecycle})
 let active=0;ctx.save();ctx.globalCompositeOperation='lighter'
 for(const p of c.particles){if(eventId!==null&&p.eventId!==eventId||ordinaryOnly&&p.type!=='ordinary'||shapesOnly&&p.type==='ordinary')continue;const s=sampleBurstParticle(p,time);if(!s.visible)continue;active++
  if(p.type==='ordinary'){const q={...p,type:'scatter',x:s.x,y:s.y-2,vx:0,vy:0,birth:0,life:2,size:p.size*Math.sqrt(s.alpha),brightness:p.brightness*s.alpha};paintParticleBrush(ctx,{particles:[q]},500,{color:p.color})}
  else{ctx.globalAlpha=s.alpha;paintBrushTip(ctx,p.type,s.x,s.y,p.size*Math.min(1,s.age/.09),p.angle+p.rotation*s.age,p.color,p)}
 }ctx.restore();return active
}
