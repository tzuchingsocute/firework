import {createDensePeak} from './dense-peak.js'
import {paintParticleBrush} from './particle-brush.js'
export function particlePosition(p,time){const t=Math.max(0,time-p.birthTime),d=(1-Math.exp(-p.drag*t))/p.drag;return {x:p.initialPosition.x+p.initialVelocity.x*d,y:p.initialPosition.y+p.initialVelocity.y*d+.5*p.gravity*t*t}}
export function createIndependentMotion(seed=1201){
 const peak=createDensePeak(seed);let n=seed;const r=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)
 const particles=peak.particles.map(p=>{const s=peak.strokes[p.strokeId],rad=Math.hypot(p.x,p.y),a=Math.atan2(p.y,p.x)+(r()-.5)*.045;return {...p,birthTime:r()*.095,initialPosition:{x:(r()-.5)*5,y:(r()-.5)*5},initialVelocity:{x:Math.cos(a)*rad*2.65,y:Math.sin(a)*rad*2.65},drag:1.65+r()*.65,gravity:35+r()*65,lifetime:(s?.spec==='fine'?1.05:1.5)+r()*1.3}})
 const batches=peak.batches.map(b=>({color:b.color,indices:b.particles.map(p=>peak.particles.indexOf(p)),particles:b.particles.map(p=>({...p}))}))
 return {seed,peak,particles,batches,duration:3.2}
}
export function paintIndependentMotion(ctx,c,time){let count=0;ctx.save();ctx.globalCompositeOperation='lighter'
 for(const b of c.batches){for(let i=0;i<b.indices.length;i++){const p=c.particles[b.indices[i]],q=b.particles[i],t=time-p.birthTime,pos=particlePosition(p,time);q.x=pos.x;q.y=pos.y-2;q.vx=q.vy=0;q.birth=0;q.life=2;const fade=t<0||t>p.lifetime?0:Math.min(1,t/.04)*Math.min(1,(p.lifetime-t)/.55);q.size=p.size*Math.sqrt(fade);q.brightness=p.brightness*fade;if(fade>0)count++}paintParticleBrush(ctx,b,500,{color:b.color})}ctx.restore();return count}
