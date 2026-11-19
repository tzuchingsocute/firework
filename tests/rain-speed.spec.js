import { writeFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

test('measures first generation, viewport entry and head contact with injected expression and head geometry',async ({page})=>{
  test.skip(!process.env.RAIN_AR_DEV_URL,'Requires Vite source modules')
  await page.goto(process.env.RAIN_AR_DEV_URL)
  await page.evaluate(async()=>{
    const {mountVisualRain}=await import('/src/rain/visual.js')
    const {expressions}=await import('/src/expression/panel.js')
    mountVisualRain({setInteractive(){},interactionFrame(){
      return {key:'timing',width:414,height:896,stageTop:0,stageHeight:896,cameraActive:true,
        patches:[{id:'head',center:{x:207,y:260,z:0},radius:{x:115,y:55,z:30},angle:0,velocity:{x:0,y:0,z:0}}],
        valid:()=>true,face:{center:207,margin:4,points:[{x:160,y:310},{x:250,y:310},{x:250,y:420},{x:160,y:420}]}}
    }},expressions)
  })
  await page.locator('#controls-toggle').click()
  const panel=page.locator('#visual-rain')
  await panel.locator(':scope > summary').click()
  await panel.locator('[data-rain-mode]').selectOption('interactive')
  await panel.locator('[data-effect-trigger]').selectOption('expression')
  await page.evaluate(async()=>{
    const {expressions}=await import('/src/expression/panel.js')
    expressions.snapshot.timestamp=performance.now()
    const started=expressions.snapshot.timestamp
    const layer=document.querySelector('#visual-rain-canvas')
    const ctx=layer.getContext('2d')
    const check=()=>{
      const pixels=ctx.getImageData(0,0,layer.width,32).data
      if(pixels.some((value,index)=>index%4===3&&value>0)) window.firstVisibleRainMs=performance.now()-started
      else if(performance.now()-started<10000) requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
    expressions.transition('SMILE',expressions.snapshot.timestamp)
  })
  const timing=panel.locator('[data-rain-response]')
  await expect(timing).toContainText(/首次头顶命中 \d+ ms/,{timeout:12000})
  const visible = await page.evaluate(() => window.firstVisibleRainMs)
  expect(visible).toBeGreaterThan(0)
  const values=(await timing.textContent()) + ' · 首个实际雨幕像素 ' + Math.round(visible) + ' ms'
  console.log(values)
  await writeFile('reports/rain-speed-timing.txt',values+'\n')
})
