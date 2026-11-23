import { test, expect } from '@playwright/test'

test.skip(process.env.APP_PUBLIC !== '1', 'Requires a Pages build')
test('unavailable domestic mirror falls back to site models without Google requests', async ({ page }) => {
  const external = [], resources = []
  const started = Date.now()
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:5175/')) external.push(request.url())
  })
  page.on('requestfinished', request => {
    if (/\.task|\.tflite|\.wasm/.test(request.url())) resources.push({url:request.url(), ms:Math.round(request.timing().responseEnd)})
  })
  await page.context().route(/^https:\/\//, route => route.abort())
  await page.goto('/firework/')
  await expect(page.locator('#camera-toggle')).toHaveText('开启摄像头', { timeout: 20000 })
  expect(await page.locator('#camera').evaluate(video => video.srcObject)).toBe(null)
  expect(external.length).toBe(3)
  expect(external.every(url => url.startsWith('https://cdn.jsdmirror.cn/'))).toBe(true)
  for (const name of ['face_landmarker.task', 'pose_landmarker_lite.task', 'selfie_multiclass_256x256.tflite']) {
    expect(resources.some(resource => resource.url.endsWith(name))).toBe(true)
  }
  console.log(JSON.stringify({readyMs:Date.now()-started, resources}))
  await page.locator('#camera-toggle').click()
  await expect(page.locator('#camera-toggle')).toHaveText('关闭摄像头')
  await expect(page.locator('#framing-guide')).toBeVisible()
  await expect(page.locator('#fps')).not.toHaveText('0 FPS', { timeout: 10000 })
  expect(external.length).toBe(3)
  expect(external.every(url => url.startsWith('https://cdn.jsdmirror.cn/'))).toBe(true)
})
