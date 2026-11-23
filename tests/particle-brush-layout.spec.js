import {test,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
test('same-budget before after brush strength at fixed seed',async({page})=>{
 await page.route('**/src/firework/particle-brush-before.js',async route=>route.fulfill({contentType:'application/javascript',body:await readFile('/tmp/particle-brush-before-layout.js','utf8')}))
 await page.goto('/')
 const result=await page.evaluate(async()=>{
 const before=await import('/src/firework/particle-brush-before.js'),after=await import('/src/firework/particle-brush.js'),versions=[before,after],brushes=versions.map(v=>v.createParticleBrush(1201))
 const c=document.createElement('canvas');c.width=828;c.height=896;c.id='strength-proof';document.body.append(c);const ctx=c.getContext('2d');const videos={},stages={}
 function draw(age,type,zoom=false){ctx.fillStyle='#15202b';ctx.fillRect(0,0,828,896);for(let i=0;i<2;i++){
 ctx.save();ctx.beginPath();ctx.rect(i*414,0,414,896);ctx.clip();ctx.fillStyle='#edf3fa';ctx.font='16px sans-serif';ctx.fillText((i?'After':'Before')+' / '+type+(zoom?' / 2x':''),i*414+15,30);ctx.translate(i*414+207,448);if(zoom)ctx.scale(2,2);versions[i].paintParticleBrush(ctx,brushes[i],age,{type});ctx.restore()}}
 const stats=versions.map((v,i)=>{let peak=0;const costs=[];for(let age=0;age<1440;age+=16){const start=performance.now();peak=Math.max(peak,v.paintParticleBrush(ctx,brushes[i],age));costs.push(performance.now()-start)}costs.sort((a,b)=>a-b);return {budget:brushes[i].budget,peak,medianMs:costs[Math.floor(costs.length/2)],p95Ms:costs[Math.floor(costs.length*.95)]}})
 for(const type of ['stream','cluster','all','zoom']){
 const chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data)
 const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));const start=performance.now();rec.start()
 function tick(now){const elapsed=now-start;draw(elapsed%1800,type==='zoom'?'all':type,type==='zoom');if(elapsed<3600)requestAnimationFrame(tick);else rec.stop()}requestAnimationFrame(tick);videos[type]=await done
 }
 for(const age of [80,300,550,950]){draw(age,'all');stages[age]=c.toDataURL()}
 draw(550,'all');return {videos,stats,stages}
 })
 expect(result.stats[0].budget).toBe(result.stats[1].budget)
 for(const [name,bytes]of Object.entries(result.videos))await writeFile(`reports/brush-layout-${name}.webm`,Buffer.from(bytes))
 for(const [age,url]of Object.entries(result.stages))await writeFile(`reports/brush-layout-${age}ms.png`,Buffer.from(url.split(',')[1],'base64'))
 await writeFile('reports/brush-layout-performance.json',JSON.stringify(result.stats,null,2))
 await page.locator('#strength-proof').screenshot({path:'reports/brush-layout-before-after.png'})
})
