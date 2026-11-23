// Independent structural candidate; shares the existing optical particles and renderer.
import {createParticleBrush as baseline,paintParticleBrush as paint} from '../../src/firework/particle-brush.js'
function random(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
export function createParticleBrush(seed=1201){
 const source=baseline(seed),r=random(Math.imul(seed,0x27d4eb2d)),particles=[],templates={}
 for(const type of ['stream','cluster','scatter'])templates[type]=source.particles.filter(p=>p.type===type)
 const cursors={stream:0,cluster:0,scatter:0},rotation=r()*6.28
 function add(role,type,birth,x,y,vx,vy,life){const t=templates[type][cursors[type]++%templates[type].length];particles.push({...t,role,type,birth,x,y,vx,vy,life})}
 const primary=[0,2.05,4.45].map((a,i)=>({id:i,angle:a+rotation+(r()-.5)*.2,reach:125+r()*30,start:.065+i*.035,span:.34+r()*.04}))
 function point(s,u){return {x:Math.cos(s.angle)*s.reach*u+Math.sin(s.angle)*u*u*14,y:Math.sin(s.angle)*s.reach*u+u*u*9}}
 // A short, asymmetric high-density center; no extra glow or new sprite.
 for(let i=0;i<90;i++){const a=rotation+r()*6.28,v=i<62?6+r()*12:20+r()*18;add('central','cluster',r()*.07,(r()-.5)*5,(r()-.5)*4,Math.cos(a)*v,Math.sin(a)*v*.75,.24+r()*.18)}
 for(const s of primary)for(let i=0;i<72;i++){
  const u=Math.max(0,Math.min(1,(i+r())/72)),p=point(s,u),side=(r()-.5)*(1+Math.sin(u*3.14)*4)
  add('primary','stream',s.start+u*s.span,p.x+Math.sin(s.angle)*side,p.y-Math.cos(s.angle)*side,Math.cos(s.angle)*(3+r()*7),Math.sin(s.angle)*(3+r()*7),.5+r()*.22)
 }
 // Short strokes have offset origins and locally turning directions, not cropped radial arms.
 const shortCounts=[30,26,24,24,22],strokes=[]
 for(let k=0;k<5;k++){
  const a=rotation+.72+k*1.13+(r()-.5)*.25,rad=35+r()*40,origin={x:Math.cos(a)*rad,y:Math.sin(a)*rad},direction=a+(k%2?-.8:.7),reach=20+r()*27,start=.22+k*.033
  strokes.push({origin,direction,reach,start})
  for(let i=0;i<shortCounts[k];i++){const u=r(),width=(r()-.5)*5;add('short','stream',start+u*.14,origin.x+Math.cos(direction)*reach*u+Math.sin(direction)*width,origin.y+Math.sin(direction)*reach*u+Math.cos(direction)*width,Math.cos(direction)*(6+r()*8),Math.sin(direction)*(6+r()*8),.31+r()*.22)}
 }
 const p=point(primary[0],.6),localCenters=[{x:p.x+Math.sin(primary[0].angle)*13,y:p.y-Math.cos(primary[0].angle)*13,start:primary[0].start+.6*primary[0].span+.025},{x:strokes[3].origin.x+10,y:strokes[3].origin.y-4,start:strokes[3].start+.05}]
 for(const center of localCenters)for(let i=0;i<36;i++){
  const a=r()*6.28,lobe=i%3,v=i<24?6+r()*10:20+r()*18
  add('local','cluster',center.start+r()*.065,center.x+(lobe-1)*3+(r()-.5)*3,center.y+(r()-.5)*5,Math.cos(a)*v*1.2,Math.sin(a)*v*.7,.33+r()*.24)
 }
 for(let i=0;i<24;i++){const center=localCenters[i%2],a=r()*2+rotation,v=18+r()*28;add('scatter','scatter',.25+r()*.35,center.x,center.y,Math.cos(a)*v,Math.sin(a)*v,.2+r()*.3)}
 const roles={central:90,primary:216,short:126,local:72,scatter:24}
 const result={seed,particles,budget:particles.length,duration:1440,roles,primary,strokes,localCenters}
 result.views={};for(const role of ['central','body','local','all'])result.views[role]={particles:role==='all'?particles:particles.filter(p=>role==='body'?['primary','short'].includes(p.role):p.role===role)}
 return result
}
export function paintParticleBrush(ctx,brush,age,{role='all',...options}={}){return paint(ctx,brush.views[role],age,options)}
