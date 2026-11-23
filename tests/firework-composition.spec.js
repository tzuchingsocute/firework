import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('independent modules, fixed complexity and four repeatable color schemes',async({page})=>{
 await page.goto('/')
 const data=await page.evaluate(async()=>{
 const {createComposition}=await import('/src/firework/composition.js')
 const {paintFirework,paintComposition}=await import('/src/firework/render.js')
 const c=document.createElement('canvas');c.width=828;c.height=828;c.id='composition-proof';document.body.append(c);const ctx=c.getContext('2d')
 for(let seed=0;seed<4;seed++){ctx.save();ctx.translate((seed%2)*414,Math.floor(seed/2)*414);ctx.fillStyle='#121c27';ctx.fillRect(0,0,414,414);paintFirework(ctx,800,{x:207,y:207},{x:0,y:0,width:414,height:414},createComposition(seed));ctx.restore()}
 const single=createComposition(0);single.fireworks=[single.fireworks[0]];delete single.sparkles
 const layers=[]
 for(let n=1;n<=3;n++){const item=structuredClone(single);if(n<3)delete item.fireworks[0].sparkles;if(n<2)delete item.fireworks[0].secondary;layers.push(item)}
 const m=document.createElement('canvas');m.width=828;m.height=300;m.id='module-proof';document.body.append(m);const mc=m.getContext('2d');mc.fillStyle='#15202b';mc.fillRect(0,0,828,300)
 layers.forEach((item,i)=>{mc.save();mc.translate(138+i*276,150);mc.scale(.7,.7);paintComposition(mc,800,item);mc.restore()})
 return {colors:Array.from({length:4},(_,i)=>createComposition(i).colors),repeat:JSON.stringify(createComposition(7))===JSON.stringify(createComposition(7))}
 })
 expect(new Set(data.colors.map(JSON.stringify)).size).toBe(4);expect(data.repeat).toBe(true)
 await page.locator('#composition-proof').screenshot({path:'reports/firework-four-palettes.png'})
 await page.locator('#module-proof').screenshot({path:'reports/firework-one-two-three-layers.png'})
 const bytes=await page.evaluate(async()=>{
 const {createComposition}=await import('/src/firework/composition.js');const {paintFirework}=await import('/src/firework/render.js')
 const c=document.querySelector('#composition-proof'),ctx=c.getContext('2d'),chunks=[]
 const rec=new MediaRecorder(c.captureStream(30),{mimeType:'video/webm;codecs=vp9'});rec.ondataavailable=e=>chunks.push(e.data)
 const done=new Promise(resolve=>rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));let start=performance.now();rec.start()
 function tick(now){ctx.fillStyle='#121c27';ctx.fillRect(0,0,828,828);for(let i=0;i<4;i++){ctx.save();ctx.translate((i%2)*414,Math.floor(i/2)*414);paintFirework(ctx,Math.min(1439,now-start),{x:207,y:207},{x:0,y:0,width:414,height:414},createComposition(i));ctx.restore()}if(now-start<1500)requestAnimationFrame(tick);else rec.stop()}requestAnimationFrame(tick);return done
 })
 await writeFile('reports/firework-composition.webm',Buffer.from(bytes))
})
