import {test,expect} from '@playwright/test'
test('complete-frame transparency remains intact on dark and pale backgrounds through full playback',async({page})=>{
 await page.goto('/')
 const result=await page.evaluate(async()=>{
 const {paintFirework}=await import('/src/firework/render.js')
 const images=await Promise.all(Array.from({length:9},(_,i)=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.src=`/firework/frame-${i}.png`})))
 const c=document.createElement('canvas');c.width=828;c.height=414;c.id='seam-proof';document.body.append(c)
 const ctx=c.getContext('2d');let maxCalls=0,edgeErrors=0
 for(let age=0;age<1440;age+=16){
  for(let side=0;side<2;side++){
   ctx.save();ctx.translate(side*414,0);ctx.fillStyle=side?'#e9e3dd':'#171b21';ctx.fillRect(0,0,414,414)
   let calls=0;const original=ctx.drawImage.bind(ctx);ctx.drawImage=(...args)=>{calls++;return original(...args)}
   paintFirework(ctx,age,{x:207,y:207},{x:0,y:0,width:414,height:414})
   ctx.drawImage=original;maxCalls=Math.max(maxCalls,calls)
   ctx.restore()
   const pixel=ctx.getImageData(side*414+1,1,1,1).data
   if(pixel[0] !== (side?233:23))edgeErrors++
  }
 }
 // Peak frame for inspecting the same artwork over two backgrounds.
 for(let side=0;side<2;side++){ctx.save();ctx.translate(side*414,0);ctx.fillStyle=side?'#e9e3dd':'#171b21';ctx.fillRect(0,0,414,414);paintFirework(ctx,800,{x:207,y:207},{x:0,y:0,width:414,height:414});ctx.restore()}
 return {maxCalls,edgeErrors}
 })
 expect(result.maxCalls).toBeLessThanOrEqual(2);expect(result.edgeErrors).toBe(0)
 await page.locator('#seam-proof').screenshot({path:'reports/firework-dark-light-seam-fix.png'})
})
