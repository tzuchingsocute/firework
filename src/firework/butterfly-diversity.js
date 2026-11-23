// Orientation sampling only; geometry, material and openness mapping are unchanged.
import {butterflyGeometry,seededButterflies} from './butterfly-shape.js'
export const diversityViews=[{name:'Front',yaw:0,pitch:0,roll:0},{name:'Left 3/4',yaw:-36,pitch:8,roll:0},{name:'Right 3/4',yaw:36,pitch:-8,roll:0},{name:'Left side',yaw:-62,pitch:12,roll:0},{name:'Right side',yaw:62,pitch:-12,roll:0},{name:'Tilt up',yaw:5,pitch:-48,roll:0},{name:'Tilt down',yaw:-5,pitch:48,roll:0},{name:'Left + tilt',yaw:-40,pitch:-30,roll:12},{name:'Right + tilt',yaw:40,pitch:30,roll:-12},{name:'Compound',yaw:48,pitch:-32,roll:32}].map(v=>({...v,openness:.7}))
function area(points){return Math.abs(points.reduce((n,p,i)=>{const q=points[(i+1)%points.length];return n+p.x*q.y-q.x*p.y},0))/2}
export function projectionMetrics(v){const surfaces=butterflyGeometry(v),p=surfaces.flatMap(s=>s.points),width=Math.max(...p.map(p=>p.x))-Math.min(...p.map(p=>p.x)),height=Math.max(...p.map(p=>p.y))-Math.min(...p.map(p=>p.y)),left=surfaces.filter(s=>s.side===-1).reduce((n,s)=>n+area(s.points),0),right=surfaces.filter(s=>s.side===1).reduce((n,s)=>n+area(s.points),0);return {width,height,area:left+right,sideRatio:Math.min(left,right)/Math.max(left,right)}}
export function sampleDiverseButterflies(seed=6062,count=20,{existingOpenness=false}={}){
 let n=seed^0x1537;const r=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296),old=seededButterflies(seed,count),samples=[];let rejected=0
 for(let i=0;i<count;i++){
  const q=r(),type=q<.15?'front':q<.5?'three-quarter':q<.65?'side':q<.8?'tilted':'combined',sign=r()<.5?-1:1,openness=existingOpenness?old[i].openness:.7
  let view
  for(let attempt=0;attempt<40;attempt++){
   const yaw=type==='front'?(r()-.5)*16:type==='three-quarter'?sign*(28+r()*18):type==='side'?sign*(55+r()*13):type==='tilted'?(r()-.5)*20:sign*(28+r()*27)
   const pitch=type==='tilted'?sign*(35+r()*18):type==='combined'?(r()<.5?-1:1)*(20+r()*20):(r()-.5)*20,roll=(r()-.5)*(type==='combined'?65:22)
   view={name:`${i+1} ${type}`,type,yaw:Math.round(yaw),pitch:Math.round(pitch),roll:Math.round(roll),openness}
   const m=projectionMetrics(view),ref=projectionMetrics({openness});if(m.width/m.height>.22&&m.area/ref.area>.38&&m.sideRatio>.025)break
   rejected++
  }
  samples.push(view)
 }return {seed,samples,rejected,counts:Object.fromEntries(['front','three-quarter','side','tilted','combined'].map(t=>[t,samples.filter(v=>v.type===t).length]))}
}
