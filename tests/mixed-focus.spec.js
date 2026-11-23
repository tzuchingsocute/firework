import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'

test('renders a fixed foreground sequence on warm skin and dark backgrounds',async({page})=>{
  test.skip(!process.env.RAIN_AR_DEV_URL,'Requires Vite source modules')
  if(process.env.MIXED_BEFORE) {
    const body=await readFile('/tmp/firework-mixed-before.js','utf8')
    await page.route('**/src/rain/droplet-appearance.js*',route=>route.fulfill({contentType:'application/javascript',body}))
  }
  await page.goto(process.env.RAIN_AR_DEV_URL)
  const counts=await page.evaluate(async()=>{
    const {createRain,defaults}=await import('/src/rain/rain.js')
    const {createDropletAppearance}=await import('/src/rain/droplet-appearance.js')
    let seed=3187
    const rain=createRain(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32))
    for(let i=0;i<900;i++)rain.advance(1/60,{...defaults,density:defaults.density*.075})
    const result=[]
    for(const [name,bg] of [['skin','#e1bfa8'],['dark','#171a20']]){
      const canvas=document.createElement('canvas')
      canvas.width=414;canvas.height=896;canvas.id='mixed-'+name
      document.body.append(canvas)
      const ctx=canvas.getContext('2d')
      const paint=createDropletAppearance(ctx)
      ctx.fillStyle=bg;ctx.fillRect(0,0,414,896)
      for(const drop of rain.drops){
        drop.lensForeground=true;drop.foregroundMix=1
        paint(drop,1,drop.brightness*drop.life*.32,40,defaults,{y:0,height:896})
      }
      result.push(rain.drops.length)
    }
    return result
  })
  expect(counts[0]).toBeGreaterThan(0)
  expect(counts[0]).toBe(counts[1])
  for(const name of ['skin','dark']) await page.locator('#mixed-'+name).screenshot({path:`reports/mixed-${name}-${process.env.MIXED_BEFORE?'before':'after'}.png`})
})
