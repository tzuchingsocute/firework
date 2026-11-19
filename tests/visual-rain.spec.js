import { mkdir } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

test('visual rain builds across the room and has independent controls', async ({ page }, info) => {
  await page.setViewportSize({ width: 1100, height: 940 })
  await page.goto('/')
  await page.locator('#controls-toggle').click()
  const panel = page.locator('#visual-rain')
  await panel.locator(':scope > summary').click()
  const layer = page.locator('#visual-rain-canvas')
  const room = page.locator('.live-room')
  await expect(layer).toBeHidden()
  await panel.getByRole('button', { name: '播放', exact: true }).click()
  await mkdir('reports', { recursive: true })
  await page.waitForTimeout(1250)
  await room.screenshot({ path: 'reports/luminous-rain-early.png' })
  await page.waitForTimeout(2400)
  await room.screenshot({ path: 'reports/luminous-rain-growth.png' })
  await page.waitForTimeout(3100)
  await room.screenshot({ path: 'reports/luminous-rain-full.png' })
  const performance = await panel.locator(':scope > div > output').textContent()
  await info.attach('rain-performance', { body: performance, contentType: 'text/plain' })
  console.log(performance)
  expect(performance).toMatch(/播放中 · [1-9]\d* 个雨滴 · 每秒 [1-9]\d* 帧/)
  await panel.getByRole('button', { name: '暂停', exact: true }).click()
  const frame = () => layer.evaluate(canvas => canvas.toDataURL())
  const paused = await frame()
  await page.waitForTimeout(180)
  expect(await frame()).toBe(paused)
  await panel.getByRole('slider', { name: '光晕强度' }).fill('0')
  expect(await frame()).not.toBe(paused)
  await panel.getByRole('button', { name: '恢复默认' }).click()
  const download = page.waitForEvent('download')
  await panel.getByRole('button', { name: '导出参数' }).click()
  expect((await download).suggestedFilename()).toBe('luminous-rain.json')
  await room.evaluate(node => { node.dataset.format = 'landscape' })
  expect(await layer.boundingBox()).toEqual(await room.boundingBox())
  await page.setViewportSize({width: 390, height: 844})
  expect(await layer.boundingBox()).toEqual(await room.boundingBox())
  await panel.getByRole('button', { name: '重新播放', exact: true }).click()
  await expect(panel.locator(':scope > div > output')).toContainText('播放中')
  await panel.getByRole('button', { name: '停止', exact: true }).click()
  await expect(layer).toBeHidden()
  await expect(page.locator('#surface-enabled')).not.toBeChecked()
})

test('uses the visible video window for spawn and clips the finished rain layer across mode and size changes', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 940 })
  await page.goto('/')
  const room = page.locator('.live-room')
  const layer = page.locator('#visual-rain-canvas')
  await room.locator('video').evaluate(video => {
    Object.defineProperties(video, { videoWidth: { value: 1280, writable: true }, videoHeight: { value: 720, writable: true } })
    video.dataset.fit = 'cover'
  })
  await page.locator('#controls-toggle').click()
  const panel = page.locator('#visual-rain')
  await panel.locator(':scope > summary').click()
  await panel.getByRole('button', { name: '播放', exact: true }).click()
  const bounds = () => layer.evaluate(canvas => JSON.parse(canvas.dataset.videoBounds))
  await expect.poll(bounds).toEqual({ x: 0, y: 0, width: 414, height: 896 })
  await page.waitForTimeout(2500)
  await room.screenshot({ path: 'reports/luminous-rain-bounds-portrait.png' })
  await page.locator('#broadcast-format').selectOption('landscape')
  await expect.poll(async () => (await bounds()).y).toBeGreaterThan(250)
  await expect.poll(async () => (await bounds()).height).toBeLessThan(300)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => Math.round((await bounds()).width)).toBe(414)
  await page.waitForTimeout(3300)
  expect(await layer.evaluate(canvas => {
    const { x, y, width, height } = JSON.parse(canvas.dataset.videoBounds)
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    let visible = 0
    for (let i = 3; i < pixels.length; i += 4) {
      if (!pixels[i]) continue
      const pixel = (i - 3) / 4
      const px = pixel % canvas.width
      const py = Math.floor(pixel / canvas.width)
      if (px + 1 <= x || px >= x + width || py + 1 <= y || py >= y + height) return false
      visible++
    }
    return visible > 0
  })).toBe(true)
  await panel.getByText('互动调试', { exact: true }).click()
  await panel.getByLabel('显示视频边界').check()
  await expect(panel.locator('[data-video-bounds]')).toContainText('雨滴起点 Y')
  await room.screenshot({ path: 'reports/luminous-rain-bounds-landscape.png' })
  await room.locator('video').evaluate(video => { video.videoWidth = 720; video.videoHeight = 1280 })
  await expect.poll(async () => (await bounds()).x).toBeGreaterThan(100)
  await expect.poll(async () => (await bounds()).width).toBeLessThan(150)
  await page.locator('#broadcast-format').selectOption('portrait')
  await expect.poll(async () => Math.round((await bounds()).height)).toBe(896)
})
