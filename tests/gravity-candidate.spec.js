import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('single seed complete gravity chain',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
 const {createGravityCandidate,paintGravityCandidate}=await import('/src/firework/gravity-candidate.js'),c=createGravityCandidate(),canvas=document.createElement('canvas');canvas.width=1656;canvas.height=896;const ctx=canvas.getContext('2d'),videos={},stills={},costs=[],counts=[]
 function draw(t){ctx.fillStyle='#15202b';ctx.fillRect(0,0,1656,896);for(let i=0;i<4;i++){ctx.save();ctx.beginPath();ctx.rect(i*414,0,414,896);ctx.clip();ctx.fillStyle='white';ctx.font='15px sans-serif';ctx.fillText(['Gravity only','Shaped tip','Secondary burst','Full composition'][i],i*414+12,25);ctx.translate(i*414+207,320);ctx.scale(.48,.48);const start=performance.now(),s=paintGravityCandidate(ctx,c,t,{endings:i!==0,only:i===1?'shaped':i===2?'secondary':null});if(i===3){costs.push(performance.now()-start);counts.push(s)}ctx.restore()}}
 const chunks=[],rec=new MediaRecorder(canvas.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));rec.start();const start=performance.now();await new Promise(resolve=>{function tick(now){draw((now-start)/1000);if(now-start<4400)requestAnimationFrame(tick);else{rec.stop();resolve()}}requestAnimationFrame(tick)});videos.chain=await done
 for(const t of [.1,.4,.9,1.4,2.3,3.8]){draw(t);stills[t]=canvas.toDataURL()}
 costs.sort((a,b)=>a-b);return {videos,stills,stats:{seed:c.seed,budget:c.peak.budget,maxActive:Math.max(...counts.map(s=>s.active)),maxBursts:Math.max(...counts.map(s=>s.bursts)),medianMs:costs[Math.floor(costs.length/2)],p95Ms:costs[Math.floor(costs.length*.95)],counts:Object.fromEntries(['natural','shaped','secondary'].map(mode=>[mode,c.events.filter(e=>e.mode===mode).length]))}}
 });expect(result.stats.maxBursts).toBeLessThanOrEqual(3)
 for(const [name,v]of Object.entries(result.videos))await writeFile(`reports/gravity-${name}.webm`,Buffer.from(v))
 for(const [name,v]of Object.entries(result.stills))await writeFile(`reports/gravity-${name}.png`,Buffer.from(v.split(',')[1],'base64'))
 await writeFile('reports/gravity-stats.json',JSON.stringify(result.stats,null,2))
})
