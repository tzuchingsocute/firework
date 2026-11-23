import {test,expect} from '@playwright/test'

test('renders four splash silhouettes with a bounded allocation and contact glints',async({page})=>{
  test.skip(!process.env.RAIN_AR_DEV_URL,'Requires Vite source modules')
  await page.goto(process.env.RAIN_AR_DEV_URL)
  const types=await page.evaluate(async()=>{
    const {paintSplash,splashType}=await import('/src/rain/splash-visual.js')
    const canvas=document.createElement('canvas')
    canvas.width=414;canvas.height=300
    canvas.id='splash-comparison'
    document.body.append(canvas)
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#121c25';ctx.fillRect(0,0,414,300)
    const ids=['droplet','droplet','glint','dot'].map(type=>Array.from({length:100},(_,i)=>i+1).find(id=>splashType(id)===type))
    for(let i=0;i<4;i++){
      const x=60+i*95
      ctx.fillStyle='#bce8fa';ctx.beginPath();ctx.arc(x,65,.8,0,Math.PI*2);ctx.fill()
      paintSplash(ctx,ids[i],x,190,75,-45,1.7,.9,.9,.04)
    }
    return ids.map(splashType)
  })
  expect(types).toEqual(['droplet','droplet','glint','dot'])
  await page.locator('#splash-comparison').screenshot({path:'reports/splash-shapes-before-after.png'})
})

test('captures a vector sparkle at appearance, peak and fade at actual size',async({page})=>{
  test.skip(!process.env.RAIN_AR_DEV_URL,'Requires Vite source modules')
  await page.goto(process.env.RAIN_AR_DEV_URL)
  await page.evaluate(async()=>{
    const {paintSplash,splashType}=await import('/src/rain/splash-visual.js')
    const id=Array.from({length:100},(_,i)=>i+1).find(id=>splashType(id)==='glint')
    const canvas=document.createElement('canvas')
    canvas.width=414;canvas.height=180;canvas.id='spark-stages'
    document.body.append(canvas)
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#14212a';ctx.fillRect(0,0,414,180)
    for(const [i,age] of [.01,.04,.145].entries())paintSplash(ctx,id,70+i*135,85,30,-30,1.25,1,.85,age)
  })
  await page.locator('#spark-stages').screenshot({path:'reports/vector-spark-stages.png'})
})

test('hollow sparkles keep a transparent center across size and perspective variants',async({page})=>{
 test.skip(!process.env.RAIN_AR_DEV_URL)
 await page.goto(process.env.RAIN_AR_DEV_URL)
 const result=await page.evaluate(async()=>{
  const {paintSplash,splashType}=await import('/src/rain/splash-visual.js')
  const c=document.createElement('canvas');c.width=414;c.height=260;c.id='spark-variants';document.body.append(c)
  const ctx=c.getContext('2d');let hollow=0,solid=0
  let count=0
  for(let id=1;id<500 && count<24;id++) {
   if(splashType(id)!=='glint')continue
   const x=30+(count%8)*50,y=45+Math.floor(count/8)*80
   paintSplash(ctx,id,x,y,20,-20,1.25,1,1,.04)
   const a=ctx.getImageData(x,y,1,1).data[3]
   if(a===0)hollow++;else solid++
   count++
  }
  return {hollow,solid}
 })
 expect(result.hollow).toBeGreaterThan(0);expect(result.solid).toBeGreaterThan(0)
 await page.locator('#spark-variants').screenshot({path:'reports/spark-variants.png'})
})
