import { test, expect } from '@playwright/test'

test('starts face tracking with external model CDNs blocked', async ({ page }) => {
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
