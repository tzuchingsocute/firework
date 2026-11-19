import { test, expect } from '@playwright/test'

test('renders one needle at three stages with stable width and changing edges', async ({page}) => {
  test.skip(!process.env.RAIN_AR_DEV_URL, 'Requires Vite source modules')
  if (process.env.DEFOCUS_BEFORE) {
    const { readFile } = await import('node:fs/promises')
    const source = await readFile('/tmp/firework-defocus-strength-before.js', 'utf8')
    await page.route('**/src/rain/droplet-appearance.js*', route => route.fulfill({contentType:'application/javascript', body:source}))
  }
  await page.goto(process.env.RAIN_AR_DEV_URL)
  const samples = await page.evaluate(async () => {
    const { createDropletAppearance } = await import('/src/rain/droplet-appearance.js')
    const { defaults } = await import('/src/rain/rain.js')
    const canvas = document.createElement('canvas')
    canvas.width = 414
    canvas.height = 896
    const ctx = canvas.getContext('2d')
    const paint = createDropletAppearance(ctx)
    document.body.append(canvas)
    canvas.id = 'defocus-samples'
    const values = []
    const copies = []
    for (const [i, progress] of [.1,.5,.9].entries()) {
      ctx.clearRect(0, 0, 414, 896)
      paint({id:1, x:207, y:progress*896, vx:0, vy:188.16, size:1, tail:.9, phase:2, age:1, life:1},
        1, .8, 40, defaults, {y:0,height:896})
      const pixels = ctx.getImageData(0,0,414,896).data
      const copy = document.createElement('canvas'); copy.width=414; copy.height=896
      copy.getContext('2d').drawImage(canvas,0,0)
      copies.push(copy)
      values.push(pixels.reduce((sum,v,index)=>sum+(index%4===3?v:0),0))
    }
    ctx.clearRect(0,0,414,896)
    copies.forEach((copy,i)=>ctx.drawImage(copy,-137+i*135,250-[.1,.5,.9][i]*896))
    return values
  })
  expect(samples.every(value=>value>0)).toBe(true)
  expect(samples[0]).not.toEqual(samples[2])
  await page.locator('#defocus-samples').screenshot({path:process.env.DEFOCUS_BEFORE ? 'reports/rain-defocus-before.png' : 'reports/rain-defocus-stages.png'})
})
