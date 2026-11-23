// P0-1 only: one analytic moving head per existing stroke; tails are untouched.
import {createIndependentMotion,paintIndependentMotion} from './independent-motion.js'
import {paintParticleBrush} from './particle-brush.js'
export function sampleHead(head,time){
 const t=Math.max(0,Math.min(head.duration,time-head.birth)),decay=Math.exp(-head.drag*t),distance=(1-decay)/head.drag
 return {x:head.initialPosition.x+head.initialVelocity.x*distance,y:head.initialPosition.y+head.initialVelocity.y*distance+.5*head.gravity*t*t,vx:head.initialVelocity.x*decay,vy:head.initialVelocity.y*decay+head.gravity*t,visible:time>=head.birth&&time<head.birth+head.duration}
}
export function createHeadCandidate(seed=1201){
 const tail=createIndependentMotion(seed);let n=seed^0x5f310;const r=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)
 const heads=tail.peak.strokes.map((s,id)=>({id,initialPosition:{...s.origin},initialVelocity:{x:Math.cos(s.angle+s.curvature*.35)*s.length*(2.5+r()*.3),y:Math.sin(s.angle+s.curvature*.35)*s.length*(2.5+r()*.3)*tail.peak.aspect},gravity:40+r()*55,drag:1.6+r()*.5,birth:.015+r()*.07,duration:1.9+r()*.7,color:tail.peak.colors[s.color],particle:{type:'stream',birth:0,life:2,vx:0,vy:0,x:0,y:0,size:s.spec==='bold'?1.25:s.spec==='fine'?.42:.8,stretch:1.2,angle:s.angle,brightness:s.brightness,shape:0}}))
 return {seed,tail,heads}
}
export function paintHeads(ctx,c,time,{tails=false}={}){
 if(tails)paintIndependentMotion(ctx,c.tail,time)
 ctx.save();ctx.globalCompositeOperation='lighter';let active=0
 for(const h of c.heads){const p=sampleHead(h,time);if(!p.visible)continue;h.particle.x=p.x;h.particle.y=p.y-2;h.particle.angle=Math.atan2(p.vy,p.vx);paintParticleBrush(ctx,{particles:[h.particle]},500,{color:h.color});active++}ctx.restore();return active
}
