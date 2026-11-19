import { test, expect } from '@playwright/test'

test('simulated camera routes two hand detections through rain, debug and the interaction switch', async ({ page }) => {
  test.skip(!process.env.RAIN_AR_DEV_URL, 'Requires Vite source modules')
  await page.addInitScript(() => {
    window.handFixture = 'palm'
    const BrowserWorker = window.Worker
    window.Worker = class extends BrowserWorker {
      constructor(url, options) {
        const mock = String(url).endsWith('/hand-worker.js')
        const code = `onmessage=({data})=>{
          data.bitmap.close();
          const points=[[.50,.70],[.44,.65],[.40,.62],[.36,.58],[.33,.55],[.45,.51],[.44,.44],[.43,.38],[.42,.32],[.50,.48],[.50,.40],[.50,.32],[.50,.25],[.55,.50],[.56,.43],[.57,.37],[.58,.32],[.59,.54],[.61,.49],[.63,.45],[.65,.42]];
          postMessage({time:data.time,key:data.key,inferenceMs:0,detections:(data.handsVisible?['Left','Right']:[]).map((side,i)=>({side,score:.96,landmarks:points.map(([x,y],j)=>({x:x+i*.25-.1,y:i===0?([0,5,9,13,17].includes(j)?(j===0?.56:.55):.64+y*.12):y}))}))});
        }`
        const fixture = mock ? URL.createObjectURL(new Blob([code], { type: 'text/javascript' })) : null
        super(fixture || url, options)
        this.mockHand = mock
        if (fixture) URL.revokeObjectURL(fixture)
      }
      postMessage(data, transfer) {
        return super.postMessage(this.mockHand ? {...data, handsVisible:window.handFixture !== 'cleared'} : data, transfer)
      }
    }
  })
  await page.setViewportSize({ width: 1100, height: 940 })
  await page.goto(process.env.RAIN_AR_DEV_URL)
  await page.evaluate(async () => {
    const video = document.querySelector('#camera')
    video.dataset.fit = 'cover'
    video.srcObject = await navigator.mediaDevices.getUserMedia({video: {width: 720,height:1280}, audio:false})
    await video.play()
    const { mountVisualRain } = await import('/src/rain/visual.js')
    mountVisualRain({
      setInteractive() {},
      interactionFrame() {
        return { key:'hand-fixture', width:414,height:896,stageTop:0,stageHeight:896,
          cameraActive:true,patches: window.handFixture === 'palm' ? [] : [{id:'left-shoulder',center:{x:250,y:520,z:0},
            radius:{x:65,y:35,z:30},angle:0,velocity:{x:0,y:0,z:0}}],valid:()=>true,
          poseDepth: {wrists:[{x:258,y:502,z:-.25,visibility:.95}],shoulders:{'left-shoulder':{z:0,visibility:.95}}},
          face:{center:207,margin:4,points:[{x:185,y:240},{x:229,y:240},{x:229,y:420},{x:185,y:420}]} }
      },
    })
  })
  await page.locator('#controls-toggle').click()
  const panel = page.locator('#visual-rain')
  await panel.locator(':scope > summary').click()
  await panel.locator('[data-rain-mode]').selectOption('interactive')
  await page.getByText('手部互动调试', { exact: true }).click()
  await expect(page.locator('[data-hand-enabled]')).toBeChecked()
  await page.getByLabel('手部关键点').check()
  await page.getByLabel('手掌碰撞体').check()
  await page.getByLabel('手指碰撞体').check()
  await page.getByLabel('手部接触点').check()
  await panel.getByRole('button',{name:'播放',exact:true}).click()
  const status = page.locator('#hand-interaction output')
  await expect(status).toContainText('左手 已识别')
  await expect(status).toContainText('右手 已识别')
  await expect(status).toContainText(/碰撞 [1-9]\d*/, { timeout:15000 })
  await expect(page.locator('[data-impact-log]')).toContainText('PALM', { timeout:15000 })
  await page.locator('.live-room').screenshot({ path:'reports/palm-side-contact.png' })
  await page.getByLabel('手掌碰撞与遮挡诊断').check()
  await page.evaluate(() => { window.handFixture = 'overlap' })
  await expect(page.locator('[data-occlusion-status]')).toContainText('FRONT')
  await page.locator('.live-room').screenshot({ path:'reports/palm-shoulder-overlap.png' })
  const diagnosticDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出碰撞日志' }).click()
  await (await diagnosticDownload).saveAs('reports/palm-occlusion-diagnostics.json')
  await page.evaluate(() => { window.handFixture = 'cleared' })
  await expect(status).toContainText('左手 未识别')
  await expect(page.locator('[data-occlusion-status]')).not.toContainText('FRONT')
  await expect(page.locator('[data-impact-log]')).toContainText('SHOULDER')
  await page.locator('.live-room').screenshot({ path:'reports/palm-shoulder-cleared.png' })
  await page.getByLabel('手掌碰撞与遮挡诊断').uncheck()
  const exportLog = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出碰撞日志' }).click()
  await (await exportLog).saveAs('reports/palm-collision-simulated.json')
  console.log(await status.textContent())
  await page.locator('.live-room').screenshot({ path:'reports/palm-collision-simulated.png' })
  for (const name of ['手部关键点', '手掌碰撞体', '手指碰撞体', '手部接触点']) {
    await page.getByLabel(name, { exact:true }).uncheck()
  }
  await expect.poll(() => page.locator('#visual-rain-canvas').evaluate(canvas =>
    canvas.getContext('2d').getImageData(190,260,35,140).data.every((value,i)=>i%4!==3 || value===0))).toBe(true)
  await page.locator('[data-hand-enabled]').uncheck()
  await expect(status).toHaveText('手部互动已关闭')
})

test('shoulder effect pixels stay outside a foreground palm and are dimmed for unknown depth', async ({ page }) => {
  test.skip(!process.env.RAIN_AR_DEV_URL, 'Requires Vite source modules')
  await page.goto(process.env.RAIN_AR_DEV_URL)
  const alpha = await page.evaluate(async () => {
    const { paintShoulderEffect } = await import('/src/hand/occlusion.js')
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 100
    const ctx = canvas.getContext('2d')
    const palm = new Path2D()
    palm.ellipse(50,50,20,12,.35,0,Math.PI*2)
    const draw = opacity => {
      ctx.clearRect(0,0,100,100)
      paintShoulderEffect(ctx,palm,opacity,100,100,alpha => {
        ctx.globalAlpha = alpha
        ctx.fillRect(0,0,100,100)
      })
      return [ctx.getImageData(50,50,1,1).data[3],ctx.getImageData(10,10,1,1).data[3]]
    }
    return [draw(0),draw(.35),draw(1)]
  })
  expect(alpha[0]).toEqual([0,255])
  expect(alpha[1][0]).toBeGreaterThan(70)
  expect(alpha[1][0]).toBeLessThan(100)
  expect(alpha[1][1]).toBe(255)
  expect(alpha[2]).toEqual([255,255])
})
