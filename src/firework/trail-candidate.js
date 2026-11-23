import{positionFinalTip,paintFinalTip}from'./final-tip-clusters.js'
import{tipParticleStyle,paintTipFragment}from'./tip-particles.js'
// P0-2: deterministic bounded emission along unchanged P0-1 heads.
import {createHeadCandidate,sampleHead,paintHeads} from './head-candidate.js'
import {lifecycleSnapshot} from './candidate-lifecycle.js'
import {paintTrailConnections} from './trail-continuity.js'
import {paintParticleBrush} from './particle-brush.js'
export function trailPosition(p,time){const age=Math.max(0,time-p.birth),d=(1-Math.exp(-p.drag*age))/p.drag;return {x:p.x+p.vx*d,y:p.y+p.vy*d+.5*p.gravity*age*age}}
export function createTrailCandidate(seed=1201){
 const head=createHeadCandidate(seed);let n=seed^0x2311;const r=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296),particles=[]
 for(const h of head.heads){const s=head.tail.peak.strokes[h.id],interval=s.spec==='bold'?.014:s.spec==='fine'?.036:.022,source=head.tail.peak.particles.filter(p=>p.strokeId===h.id)
  let index=0;for(let birth=h.birth+.015;birth<h.birth+h.duration;birth+=interval){const q=sampleHead(h,birth),template=source[index++%source.length],a=Math.atan2(q.vy,q.vx),side=(r()-.5)*s.width*.6
   particles.push({...template,headId:h.id,color:h.color,birth,life:(s.spec==='fine'?.22:.35)+r()*.25,x:q.x-Math.sin(a)*side,y:q.y+Math.cos(a)*side,vx:q.vx*.08+(r()-.5)*5,vy:q.vy*.08+(r()-.5)*5,gravity:10+r()*16,drag:2+r(),angle:a+(r()-.5)*.7})
  }
 }
 const colors=[...new Set(particles.map(p=>p.color))],batches=colors.map(color=>({color,particles:[]})),buffers=particles.map(p=>({...p}));return {seed,head,particles,buffers,batches,duration:Math.max(...particles.map(p=>p.birth+p.life))+.05}
}
export function paintTrailCandidate(ctx,c,time,{headId=null,debug=false,lifecycle=null,continuity=true}={}){
 for(const b of c.batches)b.particles.length=0
 const debugBatches=['#83ffd4','#ffd780','#e39fff'].map(color=>({color,particles:[]}));let active=0
 const snapshot=lifecycle?lifecycleSnapshot(lifecycle,time):null,allowed=snapshot?new Set(snapshot.trails):null
 for(let i=0;i<c.particles.length;i++){const p=c.particles[i],age=time-p.birth;if(allowed&&!allowed.has(p)||age<0||age>=p.life||headId!==null&&p.headId!==headId)continue;const q=c.buffers[i],pos=trailPosition(p,time);q.x=pos.x;q.y=pos.y-2;q.vx=q.vy=0;q.birth=0;q.life=2;const fade=Math.pow(1-age/p.life,1.2);q.size=p.size*Math.sqrt(fade)*(p.taperWidth??1);if(p.taperWidth){q.stretch=p.taperStretch;q.shape=i%3;}q.brightness=p.brightness*fade;const tip=c.head.heads[p.headId].tipFragments&&p.taperWidth;q.tipFragment=false;q.finalFragment=!!p.finalTip;if(p.finalTip)positionFinalTip(q,p,age,fade);if(!p.finalTip&&tip&&age<.22){const v=tipParticleStyle(i,age),a=p.angle,spread=Math.min(1,age/.12);q.x+=Math.cos(a)*v.along-Math.sin(a)*v.side*spread;q.y+=Math.sin(a)*v.along+Math.cos(a)*v.side*spread;q.size*=v.scale;q.shape=v.shape;q.tipFragment=true}
  if(c.previewLateral?.enabled){const data=c.previewLateral.data,o=i*4,factor=data[o+3];if(factor){const side=((q.x-pos.x)*data[o]+(q.y-pos.y+2)*data[o+1]+data[o+2])*factor;q.x+=data[o]*side;q.y+=data[o+1]*side}}
  if(debug)debugBatches[Math.min(2,Math.floor(age/p.life*3))].particles.push(q);else (c.previewColorBatchLookup?.get(p.color)??c.batches.find(b=>b.color===p.color)).particles.push(q);active++
 }
 ctx.save();ctx.globalCompositeOperation='lighter';if(continuity&&!debug)paintTrailConnections(ctx,c,time,{allowed,headId});for(const b of debug?debugBatches:c.batches){for(const p of b.particles)if(p.finalFragment&&!debug)paintFinalTip(ctx,p,b.color);else if(p.tipFragment&&!debug)paintTipFragment(ctx,p,b.color);paintParticleBrush(ctx,b,500,{color:b.color,skipTipFragments:!debug})}ctx.restore()
 const visibleHeads=snapshot?snapshot.heads:c.head.heads
 paintHeads(ctx,{...c.head,heads:visibleHeads.filter(h=>headId===null||h.id===headId)},time)
 return active
}
