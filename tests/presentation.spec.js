import { test, expect } from '@playwright/test'

const publicView = process.env.APP_PUBLIC === '1'

test('keeps camera controls accessible in the selected presentation', async ({ page }) => {
  await page.goto(publicView ? '/firework/' : '/')
  const debug = page.getByRole('button', { name: '展开控制面板' })
  if (publicView) {
    await expect(page.locator('.controls')).toBeHidden()
    await expect(debug).toBeHidden()
  } else {
    await expect(debug).toBeVisible()
    await debug.click()
    await expect(page.locator('#controls-content')).toBeVisible()
  }
  await expect(page.locator('#camera-toggle')).toBeVisible()
  await expect(page.locator('#camera-toggle')).toBeEnabled()
})

test('centers the public view on desktop and mobile', async ({ page }) => {
  test.skip(!publicView, 'Public presentation layout')
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 896 })
    await page.goto('/firework/')
    const room = await page.locator('.live-room').boundingBox()
    expect(Math.abs(room.x + room.width / 2 - width / 2)).toBeLessThan(2)
    await expect(page.locator('#camera-toggle')).toBeVisible()
  }
})
