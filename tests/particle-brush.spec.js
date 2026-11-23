import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('independent deterministic particle brush candidates and small burst',async({page})=>{
 await page.goto('/')
 const result=await page.evaluate(async()=>{
 const {createParticleBrush,paintParticleBrush}=await import('/src/firework/particle-brush.js')
 const brush=createParticleBrush(1201),c=document.createElement('canvas');c.width=828;c.height=896;c.id='brush-proof';document.body.append(c);const ctx=c.getContext('2d')
 const stats={budget:brush.budget,byType:{},peak:0,medianMs:0,p95Ms:0,stable:JSON.stringify(brush)===JSON.stringify(createParticleBrush(1201))}
 for(const p of brush.particles)stats.byType[p.type]=(stats.byType[p.type]??0)+1
 const costs=[];for(let i=0;i<100;i++){const start=performance.now();const count=paintParticleBrush(ctx,brush,400+i*5);costs.push(performance.now()-start);stats.peak=Math.max(stats.peak,count)}costs.sort((a,b)=>a-b);stats.medianMs=costs[50];stats.p95Ms=costs[95]
 const videos={}
 for(const mode of ['brushes','normal-zoom']){
 function draw(age){ctx.fillStyle='#15202b';ctx.fillRect(0,0,828,896)
 const types=mode==='brushes'?['stream','cluster','scatter','all']:['all','all']
 types.forEach((type,i)=>{ctx.save();const x=mode==='brushes'?(i%2)*414:i*414,y=mode==='brushes'?Math.floor(i/2)*448:0
 ctx.fillStyle='#e8eff8';ctx.font='16px sans-serif';ctx.fillText(mode==='brushes'?type:i?'2x detail':'414 x 896',x+14,y+25)
 ctx.beginPath();ctx.rect(x,y,414,mode==='brushes'?448:896);ctx.clip();ctx.translate(x+207,y+(mode==='brushes'?224:448));if(mode!=='brushes'&&i===1)ctx.scale(2,2)
 paintParticleBrush(ctx,brush,age,{type});ctx.restore()})}
 const chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data)
 const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));const start=performance.now();rec.start()
 function tick(now){const elapsed=now-start;draw(elapsed%1800);if(elapsed<5400)requestAnimationFrame(tick);else rec.stop()}requestAnimationFrame(tick);videos[mode]=await done;draw(550)
 }
 return {stats,videos}
 })
 expect(result.stats.stable).toBe(true);expect(result.stats.budget).toBeLessThan(650)
 for(const [name,bytes]of Object.entries(result.videos))await writeFile(`reports/particle-brush-${name}.webm`,Buffer.from(bytes))
 await writeFile('reports/particle-brush-performance.json',JSON.stringify(result.stats,null,2))
 await page.locator('#brush-proof').screenshot({path:'reports/particle-brush-normal-zoom.png'})
})
