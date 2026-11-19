import { test, expect } from '@playwright/test'

test('console stays outside the live preview and closing it keeps the camera running', async ({ page }) => {
  for (const [name, width, height] of [['desktop', 1080, 960], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const room = page.locator('.live-room')
    const consolePanel = page.getByRole('complementary', { name: 'Developer Console' })
    const bounds = () => room.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height }
    })
    const preview = await bounds()
    expect(preview.width / preview.height).toBeCloseTo(414 / 896, 3)
    if (name === 'desktop') expect([preview.width, preview.height]).toEqual([414, 896])
    await page.locator('#controls-toggle').click()
    expect(await bounds()).toEqual(preview)
    const consoleBounds = await consolePanel.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x + scrollX, y: rect.y + scrollY }
    })
    if (name === 'desktop') expect(consoleBounds.x).toBeGreaterThan(preview.x + preview.width)
    else expect(consoleBounds.y).toBeGreaterThan(preview.y + preview.height)
    await page.getByRole('button', { name: '开启摄像头' }).click()
    await expect(page.getByRole('button', { name: '关闭摄像头' })).toBeEnabled({ timeout: 30000 })
    await expect(page.locator('#camera-device')).toBeDisabled()
    await page.getByText('Camera Debug', { exact: true }).click()
    await expect(page.locator('#camera-debug')).toContainText('原始')
    const video = page.locator('#camera')
    await video.evaluate(element => { window.workbenchStream = element.srcObject })
    if (process.env.FRAMING_CAPTURE_DIR) {
      await expect(page.locator('#face')).toHaveText('已检测到', { timeout: 15000 })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: `${process.env.FRAMING_CAPTURE_DIR}/${name}.png`, fullPage: true })
    }
    await page.locator('#controls-toggle').click()
    await expect(page.locator('#controls-content')).toBeHidden()
    expect(await video.evaluate(element => element.srcObject === window.workbenchStream)).toBe(true)
    expect(await bounds()).toEqual(preview)
  }
})
