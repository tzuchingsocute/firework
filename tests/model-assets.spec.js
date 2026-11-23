import { basename } from 'node:path'
import { test, expect } from '@playwright/test'

test('starts face tracking with external model CDNs blocked', async ({ page }) => {
  await page.route('https://cdn.jsdmirror.cn/**', route => route.abort())
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort())
  await page.route('https://storage.googleapis.com/**', route => route.abort())
  await page.goto(process.env.APP_PUBLIC === '1' ? '/firework/' : '/')
  if (process.env.APP_PUBLIC !== '1') await page.locator('#controls-toggle').click()
  await page.locator('#camera-toggle').click()
  await expect(page.locator('#camera-toggle')).toHaveText('关闭摄像头', { timeout: 45000 })
  await expect(page.locator('#message')).toBeHidden()
  await page.locator('#camera-toggle').click()
  await expect(page.locator('#camera-toggle')).toHaveText('开启摄像头')
})


test('loads face assets through the domestic CDN', async ({ page }) => {
  const requested = []
  await page.route('https://cdn.jsdmirror.cn/**', async route => {
    const name = basename(new URL(route.request().url()).pathname)
    requested.push(name)
    await route.fulfill({
      path: name.endsWith('.task') ? 'public/mediapipe/models/v1/face_landmarker.task'
        : `node_modules/@mediapipe/tasks-vision/wasm/${name}`,
      contentType: name.endsWith('.js') ? 'application/javascript' : name.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  })
  await page.goto(process.env.APP_PUBLIC === '1' ? '/firework/' : '/')
  if (process.env.APP_PUBLIC !== '1') await page.locator('#controls-toggle').click()
  await page.locator('#camera-toggle').click()
  await expect(page.locator('#camera-toggle')).toHaveText('关闭摄像头', { timeout: 45000 })
  expect(requested).toContain('face_landmarker.task')
  expect(requested.some(name => name.endsWith('.wasm'))).toBe(true)
  await page.locator('#camera-toggle').click()
})
