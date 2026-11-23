import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('final live renderer matches confirmed preview pixels and measures actual adapter cost',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
 const live=await import('/src/firework/final-live-firework.js'),preview=await import('/src/firework/whole-firework-preview.js');
 const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=414;a.height=b.height=896;const x=a.getContext('2d'),y=b.getContext('2d'),g=preview.createWholeGroup(1201),m=g.composition.members[0],c=live.createFinalLiveFirework(1201,{role:'main'}),diffs=[],cost=[];
 for(const age of[80,650,1050,1500,2200]){x.clearRect(0,0,414,896);y.clearRect(0,0,414,896);live.paintFinalLiveFirework(x,c,age,m.position,g.bounds,m.scale);preview.paintWholeGroup(y,g,age,{scene:'main',uniformColor:true});const p=x.getImageData(0,0,414,896).data,q=y.getImageData(0,0,414,896).data;let max=0,n=0;for(let i=0;i<p.length;i++){max=Math.max(max,Math.abs(p[i]-q[i]));if(p[i]!==q[i])n++}diffs.push({age,max,differentChannels:n})}
 for(let i=0;i<80;i++){const t=performance.now();x.clearRect(0,0,414,896);live.paintFinalLiveFirework(x,c,(i%40)*50,m.position,g.bounds,m.scale);cost.push(performance.now()-t)}cost.sort((a,b)=>a-b);const data={diffs,drawMedianMs:cost[40],drawP95Ms:cost[76],scope:'414x896 main drawing only; excludes real face inference',specialCount:c.model.special.length,themes:c.model.special.map(s=>s.type),chainPoints:c.model.chain.plans.length,reservation:c.census(0).reservedParticles};live.disposeFinalLiveFirework(c);preview.disposeWholeGroup(g);return data
 });expect(result.diffs.every(d=>d.max<=1)).toBe(true);await writeFile('reports/final-live-renderer.json',JSON.stringify(result,null,2))
})
