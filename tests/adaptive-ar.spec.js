import { writeFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

test('transitions from crown through cropped hair to a hair-free visible face', async ({ page }) => {
  test.skip(!process.env.RAIN_AR_DEV_URL, 'Requires Vite source modules')
  await page.setViewportSize({ width: 1100, height: 940 })
  await page.goto(process.env.RAIN_AR_DEV_URL)
  await page.evaluate(async () => {
    window.adaptiveFixture = 'crown'
    const { mountVisualRain } = await import('/src/rain/visual.js')
    mountVisualRain({
      setInteractive() {},
      interactionFrame() {
        const phase = window.adaptiveFixture
        const full = phase === 'crown'
        const present = phase !== 'lost'
        const surface = { id:'head', center:{x:207,y:285,z:0}, radius:{x:122,y:72,z:32}, angle:0,
          velocity:{x:0,y:0,z:0} }
        return { key:'adaptive', width:414,height:896,stageTop:0,stageHeight:896,
          cameraActive:true, patches:full ? [surface] : [], valid:()=>true,
          headBounds:present ? {left:80,right:334,top:full ? 210 : 0,bottom:480} : null,
          hairBoundary:phase === 'hair' ? { x:75,step:4,values: Array.from({length:30},(_,i)=> 7+i*.8) } : null,
          face:present ? { center:207,margin:6,points:[{x:110,y:225},{x:168,y:145},{x:247,y:145},{x:306,y:225},
            {x:315,y:435},{x:245,y:530},{x:170,y:530},{x:100,y:435}] } : null,
        }
      }
    })
  })
  await page.locator('#controls-toggle').click()
  const panel = page.locator('#visual-rain')
  await panel.locator(':scope > summary').click()
  await panel.locator('[data-rain-mode]').selectOption('interactive')
  await page.getByText('自适应互动调试', { exact:true }).click()
  for (const name of ['完整头顶','可见头发边界','脸侧分流边界','显示互动权重']) await page.getByLabel(name,{exact:true}).check()
  await panel.getByRole('button',{name:'播放',exact:true}).click()
  await page.evaluate(() => {
    const canvas = document.querySelector('#visual-rain-canvas')
    const codec = 'video/webm;codecs=vp8'
    if (!MediaRecorder.isTypeSupported(codec)) return
    const composite = document.createElement('canvas')
    composite.width = canvas.width
    composite.height = canvas.height
    const ctx = composite.getContext('2d')
    const stream = composite.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType:codec })
    const chunks = []
    const draw = () => {
      ctx.fillStyle = '#171a20'
      ctx.fillRect(0,0,composite.width,composite.height)
      ctx.drawImage(canvas,0,0)
      ctx.fillStyle = '#edf4ff'
      ctx.font = '16px sans-serif'
      ctx.fillText('Geometry fixture · ' + window.adaptiveFixture,12,28)
    }
    const interval = setInterval(draw,33)
    recorder.ondataavailable = event => chunks.push(event.data)
    recorder.start()
    window.finishAdaptiveCapture = () => new Promise(resolve => {
      recorder.onstop = async () => {
        clearInterval(interval)
        stream.getTracks().forEach(track => track.stop())
        resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())))
      }
      recorder.stop()
    })
  })
  const status = page.locator('#adaptive-interaction output')
  await expect(status).toContainText('头顶 有效')
  await expect(status).toContainText(/近期碰撞 [1-9]/, {timeout:15000})
  await page.locator('.live-room').screenshot({path:'reports/adaptive-crown.png'})
  await page.evaluate(() => { window.adaptiveFixture = 'hair' })
  await expect(status).toContainText('有效区域 可见头发')
  await expect(status).toContainText(/分流 [1-9]/, {timeout:15000})
  await page.locator('.live-room').screenshot({path:'reports/adaptive-hair.png'})
  await page.evaluate(() => { window.adaptiveFixture = 'face' })
  await expect(status).toContainText('头发分割边界 0 段')
  await expect(status).toContainText('有效区域 脸侧')
  await page.waitForTimeout(1000)
  await expect(status).toContainText(/分流 [1-9]/, {timeout:15000})
  expect(await page.locator('#visual-rain-canvas').evaluate(canvas=>
    canvas.getContext('2d').getImageData(185,260,44,140).data.every((v,i)=>i%4!==3 || v===0))).toBe(true)
  await page.locator('.live-room').screenshot({path:'reports/adaptive-face.png'})
  const video = await page.evaluate(() => window.finishAdaptiveCapture?.())
  if (video?.length) await writeFile('reports/adaptive-ar-simulated.webm',Buffer.from(video))
  await page.evaluate(() => { window.adaptiveFixture = 'lost' })
  await expect(status).toContainText('有效区域 无')
  await page.evaluate(() => { window.adaptiveFixture = 'crown' })
  await expect(status).toContainText('头顶 有效')
})

test('finds cropped hair using the MediaPipe models on a video replay', async ({ baseURL }) => {
  test.skip(!process.env.ADAPTIVE_CAMERA_FIXTURE, 'Requires a cropped hair camera replay')
  // Fake capture is a browser process setting, so start an isolated process for the clip.
  const { chromium } = await import('@playwright/test')
  const cameraBrowser = await chromium.launch({ channel:'chrome', args:['--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream','--use-file-for-fake-video-capture=' + process.env.ADAPTIVE_CAMERA_FIXTURE] })
  try {
    const page = await cameraBrowser.newPage({baseURL,viewport:{width:1100,height:940}})
    await page.goto('/')
    await page.locator('#controls-toggle').click()
    await page.locator('#camera-toggle').click()
    await expect(page.locator('#camera-toggle')).toHaveText('关闭摄像头', {timeout:45000})
    const panel = page.locator('#visual-rain')
    await panel.locator(':scope > summary').click()
    await panel.locator('[data-rain-mode]').selectOption('interactive')
    await page.getByText('自适应互动调试',{exact:true}).click()
    await page.getByLabel('可见头发边界',{exact:true}).check()
    await panel.getByRole('button',{name:'播放',exact:true}).click()
    const status=page.locator('#adaptive-interaction output')
    await expect(status).toContainText(/头发分割边界 [1-9]\d* 段/, {timeout:45000})
    await expect(status).toContainText('头顶 停用')
    await page.locator('.live-room').screenshot({path:'reports/adaptive-hair-mediapipe-replay.png'})
  } finally { await cameraBrowser.close() }
})
