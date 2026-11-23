import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('stage and four seed layout playback',async({page})=>{
 await page.route('**/src/firework/particle-layout-old.js',async route=>route.fulfill({contentType:'application/javascript',body:await (await import('node:fs/promises')).readFile('/tmp/particle-brush-before-layout.js','utf8')}))
 await page.goto('/')
 const result=await page.evaluate(async()=>{
 const {createParticleBrush,paintParticleBrush}=await import('/src/firework/particle-brush.js'),old=await import('/src/firework/particle-layout-old.js')
 const c=document.createElement('canvas');c.width=1656;c.height=896;c.id='layout-proof';document.body.append(c);const ctx=c.getContext('2d'),videos={},stats=[]
 for(const mode of ['stages','seeds']){
 const brushes=mode==='stages'?[old.createParticleBrush(1201),...[1,2,3].map(stage=>createParticleBrush(1201,{stage}))]:[1201,42,917,3061].map(seed=>createParticleBrush(seed))
 for(const b of brushes)stats.push({mode,seed:b.seed,stage:b.stage,budget:b.budget,stable:JSON.stringify(b)===JSON.stringify(mode==='stages'&&!b.stage?old.createParticleBrush(b.seed):createParticleBrush(b.seed,{stage:b.stage})),ratio:b.streams?Math.max(...b.streams.map(s=>s.reach))/Math.min(...b.streams.map(s=>s.reach)):0})
 function draw(age){ctx.fillStyle='#15202b';ctx.fillRect(0,0,1656,896);brushes.forEach((b,i)=>{ctx.save();ctx.beginPath();ctx.rect(i*414,0,414,896);ctx.clip();ctx.fillStyle='#edf4fa';ctx.font='16px sans-serif';ctx.fillText(mode==='seeds'?`Seed ${b.seed}`:['Before','1 Spatial only','2 Staggered','3 Linked cluster'][i],i*414+14,28);ctx.translate(i*414+207,448);paintParticleBrush(ctx,b,age);ctx.restore()})}
 const chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));const start=performance.now();rec.start()
 function tick(now){const t=now-start;draw(t%1800);if(t<3600)requestAnimationFrame(tick);else rec.stop()}requestAnimationFrame(tick);videos[mode]=await done;draw(550)
 }
 return {videos,stats}
 })
 expect(result.stats.every(s=>s.budget===528&&s.stable)).toBe(true)
 for(const [name,bytes]of Object.entries(result.videos))await writeFile(`reports/particle-layout-${name}.webm`,Buffer.from(bytes))
 await writeFile('reports/particle-layout-seeds.json',JSON.stringify(result.stats,null,2))
 await page.locator('#layout-proof').screenshot({path:'reports/particle-layout-four-seeds.png'})
})
