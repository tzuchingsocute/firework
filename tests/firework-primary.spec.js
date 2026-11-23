import {test} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('records isolated primary before and candidate with identical color and motion clock',async({page})=>{
 await page.goto('/')
 const bytes=await page.evaluate(async()=>{
 const old=await import('/src/firework/render.js'),candidate=await import('/src/firework/render-candidate.js')
 const c=document.createElement('canvas');c.width=828;c.height=896;c.id='primary-compare';document.body.append(c);const ctx=c.getContext('2d')
 const chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data)
 const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));const start=performance.now();rec.start()
 function draw(now){const elapsed=now-start;ctx.fillStyle='#15202b';ctx.fillRect(0,0,828,896)
 for(let side=0;side<2;side++){ctx.save();ctx.translate(side*414+207,448);(side?candidate:old).paintMainBurst(ctx,(elapsed%1800)/1440,'#f5dfac');ctx.restore()}
 if(elapsed<5400)requestAnimationFrame(draw);else rec.stop()}
 requestAnimationFrame(draw);return done
 })
 await writeFile('reports/firework-primary-before-candidate.webm',Buffer.from(bytes))
})
