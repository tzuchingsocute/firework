import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('three endings and local expansion recordings',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
 const {createEndingCandidate,paintEndingCandidate}=await import('/src/firework/ending-candidate.js'),old=await import('/tests/fixtures/dense-peak-before-endings.js'),{paintDensePeak}=await import('/src/firework/dense-peak.js')
 const seeds=[1201,42,917,3061],items=seeds.map(createEndingCandidate),c=document.createElement('canvas');c.width=1656;c.height=896;const ctx=c.getContext('2d'),out={},images={},costs=[],counts=[]
 for(const mode of ['before-after','modes','shapes','bursts','seeds']){
  function draw(t){ctx.fillStyle='#15202b';ctx.fillRect(0,0,c.width,c.height)
   for(let i=0;i<4;i++){ctx.save();ctx.beginPath();ctx.rect(i*414,0,414,896);ctx.clip();ctx.fillStyle='white';ctx.font='14px sans-serif';ctx.fillText(mode==='seeds'?`Seed ${seeds[i]}`:mode==='modes'?['Natural','Shaped tip','Secondary burst','Full'][i]:mode==='shapes'?['Star','Butterfly','Flower','Mixed'][i]:mode==='bursts'?['Star burst','Butterfly burst','Flower burst','Mixed'][i]:['Before','After','Before / 2x','After / 2x'][i],i*414+10,25);ctx.translate(i*414+207,410);ctx.scale(i>=2&&mode==='before-after'?.96:.48,i>=2&&mode==='before-after'?.96:.48)
    const b=mode==='seeds'?items[i]:items[0]
    if(mode==='before-after'&&i%2===0)old.paintDensePeak(ctx,old.createDensePeak(1201))
    else if(mode==='modes'&&i===0)paintDensePeak(ctx,b.peak,{tips:false})
    else{const only=mode==='modes'&&i<3?['natural','shaped','secondary'][i]:mode==='shapes'?'shaped':mode==='bursts'?'secondary':null;const mark=performance.now();const stats=paintEndingCandidate(ctx,b,t,{only,forceShape:['shapes','bursts'].includes(mode)&&i<3?['star','butterfly','flower'][i]:null});if(mode==='seeds'){costs.push(performance.now()-mark);counts.push(stats.active)}}ctx.restore()}}
  const chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));rec.start();const start=performance.now();await new Promise(resolve=>{function tick(now){const elapsed=now-start;draw((elapsed%4200)/1000);if(elapsed<4200)requestAnimationFrame(tick);else{rec.stop();resolve()}}requestAnimationFrame(tick)});out[mode]=await done;draw(.75);images[mode]=c.toDataURL()
 }
 costs.sort((a,b)=>a-b);return {out,images,stats:{seeds:items.map(b=>({seed:b.seed,counts:b.counts,duration:b.duration,particles:b.peak.budget,extraParticles:b.events.reduce((n,e)=>n+e.particles.length,0)})),maxActive:Math.max(...counts),medianMs:costs[Math.floor(costs.length/2)],p95Ms:costs[Math.floor(costs.length*.95)]}}
 });expect(result.stats.maxActive).toBeLessThanOrEqual(3)
 for(const [name,bytes]of Object.entries(result.out))await writeFile(`reports/endings-${name}.webm`,Buffer.from(bytes))
 for(const [name,url]of Object.entries(result.images))await writeFile(`reports/endings-${name}.png`,Buffer.from(url.split(',')[1],'base64'))
 await writeFile('reports/endings-stats.json',JSON.stringify(result.stats,null,2))
})
