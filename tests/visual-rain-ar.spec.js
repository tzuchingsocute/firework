import { test, expect } from '@playwright/test'

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  ...(process.env.RAIN_AR_FIXTURE ? ['--use-file-for-fake-video-capture=' + process.env.RAIN_AR_FIXTURE] : [])] } })

test('renders luminous rain over real model tracking from a camera replay', async ({ page }) => {
  test.skip(!process.env.RAIN_AR_FIXTURE, 'Requires a camera replay fixture')
  await page.setViewportSize({ width: 1100, height: 940 })
  await page.goto('/')
  await page.locator('#controls-toggle').click()
  await page.locator('#camera-toggle').click()
  await expect(page.locator('#camera-toggle')).toHaveText('关闭摄像头', { timeout: 90000 })
  const panel = page.locator('#visual-rain')
  await panel.locator(':scope > summary').click()
  await panel.getByRole('button', { name: '播放', exact: true }).click()
  await page.waitForTimeout(5200)
  await page.locator('.live-room').screenshot({ path: 'reports/luminous-rain-ar-before.png' })
  await panel.locator('[data-rain-mode]').selectOption('interactive')
  await expect(panel.locator(':scope > div > output')).toContainText(/\d+ 个碰撞表面/, { timeout: 90000 })
  await panel.getByText('互动调试').click()
  await panel.getByLabel('碰撞点', { exact: true }).check()
  const layer = page.locator('#visual-rain-canvas')
  await expect.poll(() => layer.evaluate(canvas => Number(canvas.dataset.impacts)), { timeout: 15000 }).toBeGreaterThan(0)
  await page.locator('.live-room').screenshot({ path: 'reports/luminous-rain-ar-after.png' })
  await expect(page.locator('#surface-enabled')).not.toBeChecked()
})

test('composites replayed surface geometry and erases rain over the face', async ({ page }) => {
  test.skip(!process.env.RAIN_AR_DEV_URL, 'Requires Vite source modules')
  await page.goto(process.env.RAIN_AR_DEV_URL)
  await page.locator('#controls-toggle').click()
  await page.evaluate(async () => {
    const { mountVisualRain } = await import('/src/rain/visual.js')
    const head = { id: 'head', center: { x: 207, y: 215, z: 0 }, radius: { x: 105, y: 55, z: 38 },
      angle: 0, velocity: { x: 0, y: 0, z: 0 } }
    mountVisualRain({
      setInteractive() {},
      interactionFrame() {
        return { key: 'replay', width: 414, height: 896, stageTop: 0, stageHeight: 896,
          cameraActive: true, patches: [head], valid: () => true,
          face: { center: 207, margin: 5, points: [{ x: 130, y: 230 }, { x: 284, y: 230 }, { x: 284, y: 440 }, { x: 130, y: 440 }] } }
      },
    })
  })
  const panel = page.locator('#visual-rain')
  await panel.locator(':scope > summary').click()
  await panel.getByRole('button', { name: '播放', exact: true }).click()
  await page.waitForTimeout(4200)
  await page.locator('.live-room').screenshot({ path: 'reports/luminous-rain-ar-geometry-before.png' })
  await panel.locator('[data-rain-mode]').selectOption('interactive')
  const layer = page.locator('#visual-rain-canvas')
  await expect.poll(() => layer.evaluate(canvas => Number(canvas.dataset.impacts))).toBeGreaterThan(0)
  expect(await layer.evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(132, 232, 150, 205).data
    return pixels.every((value, i) => i % 4 !== 3 || value === 0)
  })).toBe(true)
  await page.locator('.live-room').screenshot({ path: 'reports/luminous-rain-ar-geometry-replay.png' })
})

for (const legacy of [true, false]) test(`cropped face continuity (${legacy ? 'mask only' : 'terminated tracks'})`, async ({ page }) => {
  test.skip(!process.env.RAIN_AR_DEV_URL, 'Requires Vite source modules')
  await page.addInitScript(() => {
    let seed = 1201
    Math.random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/2**32)
  })
  if (legacy) await page.route('**/src/rain/visibility.js*', async route => {
    const response = await route.fetch()
    const source = await response.text()
    await route.fulfill({ response, body: source.replace(
      /function keepVisible\([^)]*\) \{/, '$&\n  return true;') })
  })
  await page.goto(process.env.RAIN_AR_DEV_URL)
  await page.locator('#controls-toggle').click()
  await page.evaluate(async () => {
    const { mountVisualRain } = await import('/src/rain/visual.js')
    mountVisualRain({ setInteractive() {}, interactionFrame() {
      return { key: 'cropped', width: 414, height: 896, stageTop: 0, stageHeight: 896,
        cameraActive: true, patches: [], valid: () => false,
        face: { center: 207, margin: 4, points: [{x:110,y:28},{x:304,y:28},{x:304,y:420},{x:110,y:420}] } }
    } })
  })
  const panel = page.locator('#visual-rain')
  await panel.locator(':scope > summary').click()
  await panel.locator('[data-rain-mode]').selectOption('interactive')
  await panel.locator('#rain-visibility summary').click()
  await panel.locator('[data-play]').click()
  if (!legacy) await expect(panel.locator('#rain-visibility output')).toContainText(/前景结束 [1-9]/)
  await page.waitForTimeout(5800)
  const pixels = await page.locator('#visual-rain-canvas').evaluate(canvas => {
    const ctx = canvas.getContext('2d')
    const alpha = (x, width) => ctx.getImageData(x,440,width,100).data.some((v, i) => i % 4 === 3 && v > 0)
    return { belowFace: alpha(145,124), outside: alpha(0,95) || alpha(325,89) }
  })
  expect(pixels).toEqual({belowFace:legacy, outside:true})
  await page.locator('.live-room').screenshot({ path:`reports/rain-visibility-cropped-${legacy ? 'before' : 'after'}.png` })
  console.log(await panel.locator('#rain-visibility output').textContent())
})

test('close-up atmosphere remains visible with the head outside frame', async ({page}) => {
  test.skip(!process.env.RAIN_AR_DEV_URL, 'Requires Vite source modules')
  await page.goto(process.env.RAIN_AR_DEV_URL)
  await page.locator('#controls-toggle').click()
  await page.evaluate(async()=>{
    const {mountVisualRain}=await import('/src/rain/visual.js')
    window.closeRatio=.35
    mountVisualRain({setInteractive(){},interactionFrame(){
      const r=window.closeRatio
      return {key:'close',width:414,height:896,stageTop:0,stageHeight:896,cameraActive:true,patches:[],valid:()=>false,
        face:{center:207,margin:4,points:[{x:207-r*207,y:0},{x:207+r*207,y:0},{x:207+r*207,y:750},{x:207-r*207,y:750}]}}
    }})
  })
  const panel=page.locator('#visual-rain')
  await panel.locator(':scope > summary').click()
  await panel.locator('[data-rain-mode]').selectOption('interactive')
  await panel.locator('[data-play]').click()
  for(const [name,ratio] of [['normal',.35],['close',.75],['extreme',.99]]) {
    await page.evaluate(r=>{window.closeRatio=r},ratio)
    await page.waitForTimeout(4000)
    await page.locator('.live-room').screenshot({path:`reports/close-up-${name}.png`})
  }
  expect(await page.locator('#visual-rain-canvas').evaluate(c=>c.getContext('2d').getImageData(90,300,230,250).data.some((v,i)=>i%4===3&&v>0))).toBe(true)
})
