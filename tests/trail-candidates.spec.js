import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('records matched A B C materials and times their isolated draw cost',async({page})=>{
 await page.goto('/')
 const result=await page.evaluate(async()=>{
 const {paintTrailCandidate,candidateSamples}=await import('/src/firework/trail-candidates.js')
 const c=document.createElement('canvas');c.width=1242;c.height=896;c.id='abc-proof';document.body.append(c);const ctx=c.getContext('2d')
 const options={angle:-.72,length:145,bend:24,color:'#f5dfac',seed:17}
 function draw(t){ctx.fillStyle='#15202b';ctx.fillRect(0,0,1242,896)
 for(const [i,type]of ['A','B','C'].entries()){
 ctx.fillStyle='#eef4fa';ctx.font='18px sans-serif';ctx.fillText(type+' — same path / speed / color',i*414+15,28)
 ctx.save();ctx.translate(i*414+110,270);paintTrailCandidate(ctx,t,type,options);ctx.restore()
 ctx.save();ctx.translate(i*414+35,700);ctx.scale(2.2,2.2);paintTrailCandidate(ctx,t,type,options);ctx.restore()
 }}
 const timings={}
 for(const type of ['A','B','C']){const values=[];for(let r=0;r<20;r++){const start=performance.now();for(let j=0;j<100;j++)paintTrailCandidate(ctx,.55,type,options);values.push((performance.now()-start)/100)}values.sort((a,b)=>a-b);timings[type]={medianMs:values[10],p95Ms:values[19]}}
 const chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data)
 const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));const start=performance.now();rec.start()
 function tick(now){const elapsed=now-start;draw((elapsed%1800)/1440);if(elapsed<5400)requestAnimationFrame(tick);else rec.stop()}requestAnimationFrame(tick)
 const bytes=await done;draw(.6)
 return {bytes,timings,samples:candidateSamples(17).length,stable:JSON.stringify(candidateSamples(17))===JSON.stringify(candidateSamples(17))}
 })
 expect(result.samples).toBe(60);expect(result.stable).toBe(true)
 await writeFile('reports/trail-abc-comparison.webm',Buffer.from(result.bytes))
 await writeFile('reports/trail-abc-performance.json',JSON.stringify(result.timings,null,2))
 await page.locator('#abc-proof').screenshot({path:'reports/trail-abc-detail.png'})
})
