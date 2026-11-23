// Candidate-only analytic motion. Uses existing peak particles and cached sprites.
import {createEndingCandidate} from './ending-candidate.js'
import {paintParticleBrush} from './particle-brush.js'
import {paintBrushTip} from './brush-tips.js'
export function headPosition(stroke,time,aspect=1){
 const start=.025+(stroke.angle%1+1)%1*.055,t=Math.max(0,time-start),drag=2.5,travel=(1-Math.exp(-drag*t))/drag,speed=stroke.length*3.35,gravity=stroke.spec==='fine'?80:stroke.spec==='bold'?115:95
 const angle=stroke.angle+stroke.curvature*(1-Math.exp(-t*2))
 return {x:stroke.origin.x+Math.cos(angle)*speed*travel,y:stroke.origin.y+Math.sin(angle)*speed*travel*aspect+.5*gravity*t*t,vx:Math.cos(angle)*speed*Math.exp(-drag*t),vy:Math.sin(angle)*speed*Math.exp(-drag*t)*aspect+gravity*t,gravity}
}
export function createGravityCandidate(seed=1201){
 const c=createEndingCandidate(seed);c.duration=4.2
 const slots=[0,0,0]
 for(const e of c.events){const s=c.peak.strokes[e.id];if(e.mode==='secondary'&&s.spec!=='bold'&&e.id%3!==0)e.mode='natural'
  // Trigger only after the vertical velocity has turned downward; bounded by clip length.
  let t=.68+(e.id%5)*.065;while(headPosition(s,t,c.peak.aspect).vy<8&&t<1.5)t+=.025
  if(e.mode==='secondary'){const slot=slots.indexOf(Math.min(...slots));t=Math.max(t,slots[slot]);slots[slot]=t+.67}
  e.start=t;e.life=.62;const p=headPosition(s,t,c.peak.aspect);Object.assign(e,{x:p.x,y:p.y,inheritX:p.vx*.35,inheritY:p.vy*.35})
 }
 c.buffers=c.peak.batches.map(b=>({color:b.color,particles:b.particles.map(p=>({...p}))}))
 return c
}
export function paintGravityCandidate(ctx,c,time,{endings=true,only=null}={}){
 let active=0,bursts=0
 if(!only){
  for(let k=0;k<c.peak.batches.length;k++){
   const src=c.peak.batches[k],out=c.buffers[k]
   for(let i=0;i<src.particles.length;i++){
    const p=src.particles[i],q=out.particles[i],s=c.peak.strokes[p.strokeId],release=s?.spec==='fine'?.18:.1,age=Math.max(0,time-release),fade=Math.min(1,time/.07)*Math.max(0,1-(time-1.1)/(s?.spec==='bold'?1.3:.95))
    if(s){const rad=Math.hypot(p.x-s.origin.x,p.y/c.peak.aspect-s.origin.y),u=Math.min(1,rad/s.length),lag=(1-u)*.09,h=headPosition({...s,length:s.length*u},Math.max(0,time-lag),c.peak.aspect),detached=p.shape===2&&i%5===0
     q.x=h.x+(p.x-Math.cos(s.angle+s.curvature)*rad)*.16;q.y=h.y-2+(detached?38*age*age:0)
    }else{q.x=p.x*(1+time*.25);q.y=p.y+18*time*time}
    q.brightness=p.brightness*fade;q.size=p.size*Math.sqrt(Math.max(0,fade));q.birth=0;q.life=2;q.vx=q.vy=0
   }
   if(time<2.6){ctx.save();ctx.globalCompositeOperation='lighter';active+=paintParticleBrush(ctx,out,500,{color:out.color});ctx.restore()}
  }
 }
 if(endings)for(const e of c.events){if(e.mode==='natural'||only&&e.mode!==only)continue;const t=time-e.start;if(t<0||t>e.life)continue
  const alpha=Math.min(1,t/.1)*Math.min(1,(e.life-t)/.22),travel=(1-Math.exp(-3*t))/3,s=c.peak.strokes[e.id]
  const h=e.mode==='shaped'?headPosition(s,time,c.peak.aspect):{x:e.x+e.inheritX*travel,y:e.y+e.inheritY*travel+55*t*t}
  ctx.save();ctx.translate(h.x,h.y);ctx.globalCompositeOperation='lighter'
  if(e.mode==='secondary'){
   bursts++;const particles=e.particles.map(p=>({...p,life:e.life,x:p.vx*(travel-t),y:p.vy*(travel-t)+45*t*t}))
   active+=paintParticleBrush(ctx,{particles},t*1000,{color:e.color})
  }
  for(const q of e.shapes){ctx.globalAlpha=alpha;paintBrushTip(ctx,q.type,q.vx*travel,q.vy*travel+30*t*t,q.size*Math.min(1,t/.12),q.angle,e.color,q)}
  ctx.restore()
 }
 return {active,bursts}
}
