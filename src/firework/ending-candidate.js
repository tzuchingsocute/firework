import {createDensePeak,paintDensePeak} from './dense-peak.js'
import {paintBrushTip} from './brush-tips.js'
import {paintParticleBrush} from './particle-brush.js'
function random(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
const shape=r=>{const q=r();return q<.5?'star':q<.8?'butterfly':'flower'}
export function createEndingCandidate(seed=1201){
 const peak=createDensePeak(seed),r=random(seed^0x27371),events=[],slots=[0,0,0],large=[]
 for(const [id,s]of peak.strokes.entries()){
  const a=s.angle+s.curvature,x=s.origin.x+Math.cos(a)*s.length,y=(s.origin.y+Math.sin(a)*s.length)*peak.aspect
  const q=r(),mode=s.spec==='fine'||s.length<95?'natural':q<.45?'natural':q<.65?'shaped':'secondary'
  const event={id,mode,x,y,angle:a,color:peak.colors[s.color],start:.35+r()*.22,life:.48+r()*.15,shapes:[],particles:[]}
  if(mode==='shaped')event.shapes.push({type:shape(r),x:0,y:0,vx:0,vy:0,size:8+r()*7,angle:a+s.tipRotation,hollow:s.hollow,projection:s.projection})
  if(mode==='secondary'){
   let slot=slots.indexOf(Math.min(...slots));event.start=Math.max(event.start,slots[slot]);slots[slot]=event.start+event.life+.03
   // Ordinary textured particles dominate; two or three recognizable motifs drift with them.
   for(let j=0;j<22;j++){const angle=a+(r()-.5)*4.4,speed=14+r()*55;event.particles.push({type:'scatter',birth:0,life:event.life,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,x:0,y:0,size:.25+r()*.35,stretch:1+r(),angle,brightness:.5+r()*.4,shape:j%3})}
   for(let j=0;j<2+Math.floor(r()*2);j++){const angle=a+(r()-.5)*3.6,speed=24+r()*40;event.shapes.push({type:shape(r),x:0,y:0,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,size:4+r()*6,angle:r()*3,projection:.75+r()*.25})}
  }
  for(const s of event.shapes){if(s.size>=12){if(large.length>=2)s.size=10;else large.push(s)}}
  events.push(event)
 }
 return {seed,peak,events,duration:Math.max(1.44,...events.map(e=>e.start+e.life)),counts:Object.fromEntries(['natural','shaped','secondary'].map(mode=>[mode,events.filter(e=>e.mode===mode).length])),maxBursts:3,maxLarge:2}
}
export function paintEndingCandidate(ctx,c,seconds,{only=null,forceShape=null}={}){
 if(!only)paintDensePeak(ctx,c.peak,{tips:false})
 let active=0,shapes=0
 for(const e of c.events){if(e.mode==='natural'||only&&only!==e.mode)continue;const t=seconds-e.start;if(t<0||t>=e.life)continue
  const progress=t/e.life,alpha=Math.min(1,t/.07)*Math.min(1,(1-progress)/.35),travel=(1-Math.exp(-3*t))/3
  ctx.save();ctx.translate(e.x,e.y);ctx.globalAlpha=alpha;ctx.globalCompositeOperation='lighter'
  if(e.mode==='secondary'){active++;const b={particles:e.particles.map(p=>({...p,x:p.vx*(travel-t),y:p.vy*(travel-t)}))};paintParticleBrush(ctx,b,t*1000,{color:e.color})}
  for(const s of e.shapes){ctx.save();ctx.globalAlpha=alpha;const scale=.35+.65*Math.min(1,t/.12);paintBrushTip(ctx,forceShape||s.type,s.vx*travel,s.vy*travel,s.size*scale,s.angle,e.color,s);ctx.restore();shapes++}
  ctx.restore()
 }
 return {active,shapes}
}
