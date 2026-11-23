import {test} from '@playwright/test'
import {readFile} from 'node:fs/promises'

test('captures the same optical splash arrangement before and after scale refinement',async({page})=>{
  test.skip(!process.env.RAIN_AR_DEV_URL,'Requires Vite source modules')
  if(process.env.SCALE_BEFORE) {
    const body=await readFile('/tmp/firework-scale-before-splash.js','utf8')
    await page.route('**/src/rain/splash-visual.js*',route=>route.fulfill({contentType:'application/javascript',body}))
  }
  await page.goto(process.env.RAIN_AR_DEV_URL)
  await page.evaluate(async()=>{
    const {paintSplash,splashType}=await import('/src/rain/splash-visual.js')
    const canvas=document.createElement('canvas')
    canvas.id='scale-frame';canvas.width=414;canvas.height=896
    document.body.append(canvas)
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#171f26';ctx.fillRect(0,0,414,896)
    for(let id=1;id<=35;id++) {
      const x=40+(id%7)*54
      const y=110+Math.floor(id/7)*100
      paintSplash(ctx,id,x,y,45,-35,1.25,.85,.8,.035)
    }
  })
  await page.locator('#scale-frame').screenshot({path:`reports/splash-scale-${process.env.SCALE_BEFORE?'before':'after'}.png`})
})
