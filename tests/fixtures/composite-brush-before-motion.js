// Isolated visual-fusion candidate. Optical sprites and formal effects stay unchanged.
import {createParticleBrush as baseline,paintParticleBrush as paint} from '../../src/firework/particle-brush.js'
function random(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
export function createParticleBrush(seed=1201){
 const source=baseline(seed),r=random(Math.imul(seed,0x27d4eb2d)),particles=[],templates={}
 for(const type of ['stream','cluster','scatter'])templates[type]=source.particles.filter(p=>p.type===type)
 const cursors={stream:0,cluster:0,scatter:0},rotation=r()*Math.PI*2
 function add(role,type,birth,x,y,vx,vy,life,relation={}){const t=templates[type][cursors[type]++%templates[type].length];particles.push({...t,role,type,birth,x,y,vx,vy,life,...relation})}
 const primary=[0,2.05,4.45].map((a,i)=>({id:i,angle:a+rotation+(r()-.5)*.2,reach:125+r()*30,start:.055+i*.022,span:.37+r()*.025}))
 function point(s,u){return {x:Math.cos(s.angle)*s.reach*u+Math.sin(s.angle)*u*u*14,y:Math.sin(s.angle)*s.reach*u+u*u*9}}
 // Two overlapping releases: compact ignition, then an irregular outward shoulder.
 // A longer-lived minority keeps a visible center during the common 400–550ms peak.
 for(let i=0;i<90;i++){
  const lobe=i%5,a=rotation+lobe*1.24+(r()-.5)*.7,core=i<45,v=core?3+r()*5:35+r()*65
  add('central','cluster',core?r()*.025:.025+r()*.055,(r()-.5)*5,(r()-.5)*4,Math.cos(a)*v,Math.sin(a)*v*.85,core?.75+r()*.07:.43+r()*.15)
 }
 for(const s of primary)for(let i=0;i<52;i++){
  const u=(i+r())/52,p=point(s,u),side=(r()-.5)*(2+Math.sin(u*Math.PI)*8)
  add('primary','stream',s.start+u*s.span,p.x+Math.sin(s.angle)*side,p.y-Math.cos(s.angle)*side,Math.cos(s.angle)*(5+r()*9),Math.sin(s.angle)*(5+r()*9),.51+r()*.18,{parentId:s.id,pathU:u})
 }
 const strokes=[],counts=[36,36,36,26,26,26]
 for(let k=0;k<6;k++){
  const associated=k<3,parent=primary[k%3],u=.33+k%3*.115,p=point(parent,u)
  const a=associated?parent.angle+(k%2?-.68:.75):rotation+[1.02,3.14,5.4][k-3]
  const origin=associated?{x:p.x,y:p.y}:{x:Math.cos(a)*9,y:Math.sin(a)*9}
  const start=associated?parent.start+u*parent.span:.09+(k-3)*.018,reach=associated?39+r()*16:65+r()*18
  const stroke={associated,parentId:associated?parent.id:null,pathU:u,origin,direction:a,reach,start,span:.19};strokes.push(stroke)
  for(let i=0;i<counts[k];i++){
   const q=r(),side=(r()-.5)*(7+Math.sin(q*Math.PI)*15),inherit=associated?12:0
   add(associated?'associated':'free','stream',start+q*stroke.span,origin.x+Math.cos(a)*reach*q+Math.sin(a)*side,origin.y+Math.sin(a)*reach*q-Math.cos(a)*side,Math.cos(a)*(17+r()*15)+Math.cos(parent.angle)*inherit,Math.sin(a)*(17+r()*15)+Math.sin(parent.angle)*inherit,.44+r()*.18,{parentId:stroke.parentId})
  }
 }
 // One 72-particle local bloom: enough density for a core AND visible expansion.
 const anchor=strokes[1],q=.5,center={x:anchor.origin.x+Math.cos(anchor.direction)*anchor.reach*q,y:anchor.origin.y+Math.sin(anchor.direction)*anchor.reach*q,start:anchor.start+q*anchor.span,parentId:anchor.parentId,strokeId:1,pathU:q},localCenters=[center]
 for(let i=0;i<72;i++){
  const lobe=i%4,a=anchor.direction+[-1.2,-.3,.8,2.5][lobe]+(r()-.5)*.8,core=i<16,v=core?9+r()*17:55+r()*90
  add('local','cluster',center.start+r()*.035,center.x+(r()-.5)*6,center.y+(r()-.5)*6,Math.cos(a)*v+Math.cos(anchor.direction)*16,Math.sin(a)*v*.8+Math.sin(anchor.direction)*16,core?.43+r()*.1:.37+r()*.22,{parentId:center.parentId})
 }
 for(let i=0;i<24;i++){
  const s=strokes[i%6],u=.65,p={x:s.origin.x+Math.cos(s.direction)*s.reach*u,y:s.origin.y+Math.sin(s.direction)*s.reach*u},a=s.direction+(r()-.5)*1.3,v=25+r()*35
  add('scatter','scatter',s.start+s.span*u+r()*.06,p.x,p.y,Math.cos(a)*v,Math.sin(a)*v,.35+r()*.25)
 }
 const roles={central:90,primary:156,short:186,local:72,scatter:24}
 const result={seed,particles,budget:particles.length,duration:1440,roles,primary,strokes,localCenters}
 const selectors={central:['central'],primary:['primary'],associated:['primary','associated'],body:['primary','associated','free'],local:['local'],linked:['primary','associated','local']}
 result.views={all:{particles}};for(const [view,roles] of Object.entries(selectors))result.views[view]={particles:particles.filter(p=>roles.includes(p.role))}
 return result
}
export function paintParticleBrush(ctx,brush,age,{role='all',...options}={}){return paint(ctx,brush.views[role],age,options)}
