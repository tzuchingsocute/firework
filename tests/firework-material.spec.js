import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('records reference-driven single trail and 6/8/10/12-ray primary variants',async({page})=>{
 await page.goto('/')
 const result=await page.evaluate(async()=>{
 const {paintTexturedTrail}=await import('/src/firework/trail-material.js')
 const {paintMainBurst}=await import('/src/firework/render-candidate.js')
 const c=document.createElement('canvas');c.width=828;c.height=828;c.id='material-proof';document.body.append(c);const ctx=c.getContext('2d')
 function paint(t,mode){ctx.fillStyle='#121c27';ctx.fillRect(0,0,828,828)
 for(let i=0;i<4;i++){ctx.save();ctx.translate(207+(i%2)*414,207+Math.floor(i/2)*414)
 if(mode==='single'){ctx.scale(1.6,1.6);paintTexturedTrail(ctx,t,{angle:-.8,length:140,bend:24,color:'#f5dfac',seed:i})}
 else paintMainBurst(ctx,t,'#f5dfac',1,false,{rays:[6,8,10,12][i]})
 ctx.restore()}}
 window.paintMaterial=paint;paint(.55,'main')
 const output={}
 for(const mode of ['single','main']){
 const chunks=[],rec=new MediaRecorder(c.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data)
 const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));const start=performance.now();rec.start()
 function tick(now){const elapsed=now-start;paint((elapsed%1800)/1440,mode);if(elapsed<3600)requestAnimationFrame(tick);else rec.stop()}requestAnimationFrame(tick);output[mode]=await done
 }
 paint(.55,'main');return output
 })
 for(const mode of ['single','main']){expect(result[mode].length).toBeGreaterThan(1000);await writeFile(`reports/firework-textured-${mode}.webm`,Buffer.from(result[mode]))}
 await page.locator('#material-proof').screenshot({path:'reports/firework-center-6-8-10-12.png'})
})
