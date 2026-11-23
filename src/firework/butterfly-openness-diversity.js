import {seededButterflies} from './butterfly-shape.js'
import {sampleDiverseButterflies,projectionMetrics} from './butterfly-diversity.js'
export const opennessBands=[{name:'Fully Open',min:.8,max:.95,weight:.25},{name:'Semi-Open',min:.6,max:.8,weight:.35},{name:'Half-Open',min:.35,max:.6,weight:.25},{name:'Folded',min:.15,max:.35,weight:.15}]
function random(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
export function groupedOpenness(seed=6062,count=20,{front=false}={}){
 const r=random(seed^0x26e2),angles=sampleDiverseButterflies(seed,count).samples,old=seededButterflies(seed,count);let rejected=0;const unresolved=[]
 const samples=angles.map((a,i)=>{let q=r(),band=opennessBands.at(-1);for(const b of opennessBands){q-=b.weight;if(q<0){band=b;break}}
  const orientation=front?{...a,yaw:0,pitch:0,roll:0}:a
  let openness,accepted=false,best=null
  for(let k=0;k<32;k++){
   const value=band.min+r()*(band.max-band.min),m=projectionMetrics({...orientation,openness:value}),score=Math.min(m.width/m.height/.22,m.area/260)
   if(!best||score>best.score)best={value,score}
   if(score>1){openness=value;accepted=true;break}rejected++
  }
  if(!accepted){openness=best.value;unresolved.push(i)}
  return {...a,...(front?{yaw:0,pitch:0,roll:0}:{}),openness,state:band.name,name:`${i+1} ${band.name}`}
 });return {seed,samples,before:angles.map((a,i)=>({...a,openness:old[i].openness})),rejected,unresolved,counts:Object.fromEntries(opennessBands.map(b=>[b.name,samples.filter(v=>v.state===b.name).length]))}
}
export function bandExamples(seed=6062){const r=random(seed);return opennessBands.flatMap(b=>Array.from({length:5},()=>({yaw:0,pitch:0,roll:0,openness:b.min+r()*(b.max-b.min),name:b.name})))}
