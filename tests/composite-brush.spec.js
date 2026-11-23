import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('isolated visual roles, baseline and four seed composite playback',async({page})=>{
 await page.goto('/')
 const result=await page.evaluate(async()=>{
 const next=await import('/src/firework/composite-brush.js'),old=await import('/src/firework/particle-brush.js')
 const c=document.createElement('canvas');c.width=1656;c.height=896;c.id='composite-proof';document.body.append(c);const ctx=c.getContext('2d'),videos={},stills={},brush=next.createParticleBrush(1201),base=old.createParticleBrush(1201)
 const costs=[],counts=[];for(let age=0;age<1440;age+=16){const start=performance.now();counts.push(next.paintParticleBrush(ctx,brush,age));costs.push(performance.now()-start)}costs.sort((a,b)=>a-b)
 for(const mode of ['roles','before-after','seeds']){
  const brushes=mode==='seeds'?[1201,42,917,3061].map(s=>next.createParticleBrush(s)):[brush,brush,brush,brush]
  function draw(age){ctx.fillStyle='#15202b';ctx.fillRect(0,0,1656,896);for(let i=0;i<4;i++){
   ctx.save();ctx.beginPath();ctx.rect(i*414,0,414,896);ctx.clip();ctx.fillStyle='#eef4fa';ctx.font='16px sans-serif'
   const label=mode==='roles'?['Central burst','Primary + short strokes','Local bursts','Full composition'][i]:mode==='seeds'?`Seed ${brushes[i].seed}`:['Before / 414x896','After / 414x896','Before / 2x','After / 2x'][i]
   ctx.fillText(label,i*414+12,26);ctx.translate(i*414+207,448)
   if(mode==='before-after'&&i>=2)ctx.scale(2,2)
   if(mode==='before-after'&&i%2===0)old.paintParticleBrush(ctx,base,age)
   else next.paintParticleBrush(ctx,brushes[i],age,{role:mode==='roles'?['central','body','local','all'][i]:'all'})
   ctx.restore()}}
  const chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));const start=performance.now();rec.start()
  function tick(now){const elapsed=now-start;draw(elapsed%1800);if(elapsed<3600)requestAnimationFrame(tick);else rec.stop()}requestAnimationFrame(tick);videos[mode]=await done
  for(const age of [100,300,550,900]){draw(age);stills[mode+'-'+age]=c.toDataURL()}
 }
 return {videos,stills,stats:{budget:brush.budget,roles:brush.roles,peak:Math.max(...counts),medianMs:costs[Math.floor(costs.length/2)],p95Ms:costs[Math.floor(costs.length*.95)],stable:JSON.stringify(brush)===JSON.stringify(next.createParticleBrush(1201))}}
 })
 expect(result.stats.budget).toBe(528);expect(result.stats.stable).toBe(true)
 for(const [name,bytes]of Object.entries(result.videos))await writeFile(`reports/composite-brush-${name}.webm`,Buffer.from(bytes))
 for(const [name,url]of Object.entries(result.stills))await writeFile(`reports/composite-brush-${name}.png`,Buffer.from(url.split(',')[1],'base64'))
 await writeFile('reports/composite-brush-performance.json',JSON.stringify(result.stats,null,2))
})
