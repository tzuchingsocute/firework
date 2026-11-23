import { basename } from 'node:path'
import { test, expect } from '@playwright/test'

test.skip(process.env.APP_PUBLIC !== '1', 'Requires a Pages build')

async function preparePublicPage(page, mockSurface = true) {
  let releaseFace
  const faceGate = new Promise((resolve) => {
    releaseFace = resolve
  })
  await page.route('**/mediapipe/models/v1/face_landmarker.task', async (route) => {
    const name = basename(new URL(route.request().url()).pathname)
    if (name.endsWith('.task')) await faceGate
    await route.fulfill({
      path: name.endsWith('.task')
        ? 'public/mediapipe/models/v1/face_landmarker.task'
        : `node_modules/@mediapipe/tasks-vision/wasm/${name}`,
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentType: name.endsWith('.js')
        ? 'application/javascript'
        : name.endsWith('.wasm')
          ? 'application/wasm'
          : 'application/octet-stream',
    })
  })
  await page.addInitScript((mockSurface) => {
    window.cameraRequests = 0
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    )
    navigator.mediaDevices.getUserMedia = (constraints) => {
      window.cameraRequests++
      return getUserMedia(constraints)
    }
    if (!mockSurface) return
    window.Worker = class extends EventTarget {
      constructor() {
        super()
        window.surfaceTestWorker = this
      }
      postMessage(data) {
        if (data.type === 'prepare') this.preparing = true
        else data.bitmap.close()
      }
      terminate() {
        this.onmessage = null
      }
      finish(error) {
        this.onmessage?.({ data: error ? { error } : { type: 'ready' } })
      }
    }
  }, mockSurface)
  await page.goto('/firework/')
  return releaseFace
}

test('public page preloads models before enabling camera and never requests permission automatically', async ({
  page,
}) => {
  const releaseFace = await preparePublicPage(page)
  const button = page.locator('#camera-toggle')
  await expect(page.locator('.controls')).toBeHidden()
  await expect(button).toHaveText('加载中...')
  await expect(button).toBeDisabled()
  expect(await page.evaluate(() => window.cameraRequests)).toBe(0)
  await expect(page.locator('#framing-guide')).toBeHidden()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(window.surfaceTestWorker?.preparing)),
    )
    .toBe(true)
  await page.evaluate(() => window.surfaceTestWorker.finish())
  await expect(button).toBeDisabled()
  releaseFace()
  await expect(button).toHaveText('开启摄像头', { timeout: 20000 })
  await expect(button).toBeEnabled()
  expect(await page.evaluate(() => window.cameraRequests)).toBe(0)
  await button.click()
  await expect(button).toHaveText('关闭摄像头')
  await expect(page.locator('#framing-message')).toHaveText(
    '请让头部与双肩进入画面',
  )
  expect(await page.evaluate(() => window.cameraRequests)).toBe(1)
  await button.click()
  await expect(page.locator('#framing-guide')).toBeHidden()
})

test('public preload failure offers retry without opening the camera', async ({
  page,
}) => {
  const releaseFace = await preparePublicPage(page)
  releaseFace()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(window.surfaceTestWorker?.preparing)),
    )
    .toBe(true)
  await page.evaluate(() =>
    window.surfaceTestWorker.finish('test download failure'),
  )
  await expect(page.locator('#camera-toggle')).toHaveText('重试加载')
  await expect(page.locator('#message')).toContainText('模型加载失败')
  expect(await page.evaluate(() => window.cameraRequests)).toBe(0)
  await page.locator('#camera-toggle').click()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(window.surfaceTestWorker?.preparing)),
    )
    .toBe(true)
  await page.evaluate(() => window.surfaceTestWorker.finish())
  await expect(page.locator('#camera-toggle')).toHaveText('开启摄像头', {
    timeout: 20000,
  })
  expect(await page.evaluate(() => window.cameraRequests)).toBe(0)
})

test('public HTML shows disabled loading before the main JavaScript is available', async ({
  page,
}) => {
  await page.route('**/assets/index-*.js', (route) => route.abort())
  await page.goto('/firework/')
  const button = page.locator('[data-camera-bootstrap] button')
  await expect(button).toHaveText('加载中...')
  await expect(button).toBeVisible()
  await expect(button).toBeDisabled()
})
