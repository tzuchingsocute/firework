import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('isolated visual roles, baseline and four seed composite playback',async({page})=>{
 await page.goto('/')
 const result=await page.evaluate(async()=>{
 const next=await import('/src/firework/composite-brush.js'),old=await import('/tests/fixtures/composite-brush-before-groups.js')
 const c=document.createElement('canvas');c.width=1656;c.height=896;c.id='composite-proof';document.body.append(c);const ctx=c.getContext('2d'),videos={},stills={},brush=next.createParticleBrush(1201),base=old.createParticleBrush(1201)
 const costs=[],counts=[],oldCosts=[],oldCounts=[];for(let age=0;age<1440;age+=16){const start=performance.now();counts.push(next.paintParticleBrush(ctx,brush,age));costs.push(performance.now()-start)}for(let age=0;age<1440;age+=16){const start=performance.now();oldCounts.push(old.paintParticleBrush(ctx,base,age));oldCosts.push(performance.now()-start)}oldCosts.sort((a,b)=>a-b);costs.sort((a,b)=>a-b)
 for(const mode of ['roles','relations','before-after','seeds','debug','full']){
  c.width=mode==='full'?414:1656;
  const brushes=mode==='seeds'?[1201,42,917,3061].map(s=>next.createParticleBrush(s)):[brush,brush,brush,brush]
  function draw(age){ctx.fillStyle='#15202b';ctx.fillRect(0,0,1656,896);for(let i=0;i<(mode==='full'?1:4);i++){
   ctx.save();ctx.beginPath();ctx.rect(i*414,0,414,896);ctx.clip();ctx.fillStyle='#eef4fa';ctx.font='16px sans-serif'
   const label=mode==='full'?'Visual Fusion / 414x896':mode==='roles'?['Central burst','Primary + short strokes','Local expansion','Full fusion'][i]:mode==='relations'?['Primary only','Primary + associated','Local only','Primary + associated + local'][i]:mode==='seeds'?`Seed ${brushes[i].seed}`:['Before / 414x896','After / 414x896','Before / 2x','After / 2x'][i]
   ctx.fillText(label,i*414+12,26);ctx.translate(i*414+207,448)
   if(mode==='before-after'&&i>=2)ctx.scale(2,2)
   if(mode==='before-after'&&i%2===0)old.paintParticleBrush(ctx,base,age)
   else next.paintParticleBrush(ctx,brushes[i],age,{role:mode==='roles'?['central','groups','local','all'][i]:mode==='relations'?['primary','associated','local','linked'][i]:'all'})
   if(mode==='debug'){
    ctx.strokeStyle='#69c9ff';ctx.lineWidth=1
    const roles=['primary','associated','local','central'],selected=brushes[i].particles.filter(p=>p.role===roles[i]);
    for(let k=0;k<selected.length;k+=Math.max(1,Math.floor(selected.length/12))){const p=selected[k],t=age/1000-p.birth;if(t<0||t>p.life)continue;const d=(1-Math.exp(-3.2*t))/3.2,x=p.x+p.vx*d,y=p.y+p.vy*d+8*t*t,a=Math.atan2(p.vy,p.vx),len=18;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len);ctx.lineTo(x+Math.cos(a)*len-Math.cos(a-.5)*6,y+Math.sin(a)*len-Math.sin(a-.5)*6);ctx.stroke()}
   }
   ctx.restore()}}
  const chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));const start=performance.now();rec.start()
  function tick(now){const elapsed=now-start;draw(elapsed%1800);if(elapsed<3600)requestAnimationFrame(tick);else rec.stop()}requestAnimationFrame(tick);videos[mode]=await done
  for(const age of [100,250,480,750]){draw(age);stills[mode+'-'+age]=c.toDataURL()}
 }
 return {videos,stills,stats:{before:{budget:base.budget,peak:Math.max(...oldCounts),medianMs:oldCosts[Math.floor(oldCosts.length/2)],p95Ms:oldCosts[Math.floor(oldCosts.length*.95)]},budget:brush.budget,roles:brush.roles,peak:Math.max(...counts),medianMs:costs[Math.floor(costs.length/2)],p95Ms:costs[Math.floor(costs.length*.95)],stable:JSON.stringify(brush)===JSON.stringify(next.createParticleBrush(1201))}}
 })
 expect(result.stats.budget).toBe(528);expect(result.stats.stable).toBe(true)
 for(const [name,bytes]of Object.entries(result.videos))await writeFile(`reports/groups-brush-${name}.webm`,Buffer.from(bytes))
 for(const [name,url]of Object.entries(result.stills))await writeFile(`reports/groups-brush-${name}.png`,Buffer.from(url.split(',')[1],'base64'))
 await writeFile('reports/groups-brush-performance.json',JSON.stringify(result.stats,null,2))
})
