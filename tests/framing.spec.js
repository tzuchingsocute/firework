import { test, expect } from '@playwright/test'

test('switches video layout inside the same portrait room and camera stream', async ({ page }, info) => {
  await page.setViewportSize({ width: Number(process.env.FRAMING_VIEWPORT || 960), height: Number(process.env.FRAMING_HEIGHT || 900) })
  if (process.env.EXPECT_SAFE_CROP) {
    // Supply known geometry for this rendering test. Native model coverage runs separately.
    await page.addInitScript(() => {
      window.Worker = class extends EventTarget {
        postMessage(frame) {
          frame.bitmap.close()
          const size = 80
          const mask = new Uint8Array(size * size)
          const shift = window.testSubjectShift || 0
          const dx = Math.round(shift * size)
          for (let y = 12; y < 34; y++) for (let x = 31; x < 49; x++) mask[y * size + x + dx] = y < 20 ? 1 : 3
          for (let y = 42; y < 58; y++) for (let x = 30; x < 50; x++) mask[y * size + x + dx] = 4
          const pose = Array.from({ length: 33 }, () => ({ x: .5 + shift, y: .32, z: 0, visibility: 1 }))
          pose[11] = { x: .37 + shift, y: .5, z: 0, visibility: 1 }
          pose[12] = { x: .63 + shift, y: .5, z: 0, visibility: 1 }
          const { time, videoWidth, videoHeight, mode } = frame
          queueMicrotask(() => this.onmessage?.({ data: { time, videoWidth, videoHeight, mode,
            chin: { x: .5 + shift, y: .42 }, pose, mask, maskWidth: size, maskHeight: size } }))
        }
        terminate() { this.onmessage = null }
      }
    })
  }
  await page.goto('/')
  await expect(page.locator('#controls-toggle')).toHaveAttribute('aria-expanded', 'false')
  await page.locator('#controls-toggle').click()
  const selector = page.locator('#broadcast-format')
  const video = page.locator('#camera')
  const panel = page.locator('#camera-debug')
  await expect(selector).toHaveValue('portrait')
  await page.getByRole('button', { name: '开启摄像头' }).click()
  await expect(page.getByRole('button', { name: '关闭摄像头' })).toBeEnabled({ timeout: 30000 })
  await video.evaluate(element => { window.originalCameraStream = element.srcObject })
  await page.getByText('Camera Debug', { exact: true }).click()
  await expect(panel).toContainText('源范围 X')
  for (const mode of ['portrait', 'landscape', 'portrait']) {
    await selector.selectOption(mode)
    await expect(panel).toContainText(mode === 'portrait' ? '竖屏视频' : '横屏视频')
    if (process.env.EXPECT_SAFE_CROP && mode === 'portrait') {
      await expect(panel).toContainText('Locked Crop', { timeout: 45000 })
    }
    const rect = await video.boundingBox()
    const room = await page.locator('.live-room').boundingBox()
    const source = await video.evaluate(element => element.videoWidth / element.videoHeight)
    expect(room.width / room.height).toBeCloseTo(414 / 896, 3)
    const viewport = page.viewportSize()
    const expectedWidth = Math.min(414, viewport.width, viewport.height * 414 / 896)
    expect(room.width).toBeCloseTo(expectedWidth, 0)
    expect(room.height).toBeCloseTo(expectedWidth * 896 / 414, 0)
    console.log(mode, { room, video: rect })
    expect(rect.width).toBeCloseTo(room.width, 0)
    expect(rect.x).toBeCloseTo(room.x, 0)
    if (mode === 'landscape') {
      expect(rect.y - room.y).toBeCloseTo((room.height - rect.height) / 2, 0)
      expect(rect.width / rect.height).toBeCloseTo(source > 1 ? source : 16 / 9, 2)
      await expect(panel).toContainText('横裁 0.0% · 纵裁 0.0%')
    } else {
      expect(rect.height).toBeCloseTo(room.height, 0)
      await expect(video).toHaveCSS('object-fit', 'cover')
      const marker = await page.addStyleTag({ content: `
        .live-stage { background: #ff00ff !important; }
        .live-room > :not(.live-stage), .live-stage canvas { visibility: hidden !important; }
      ` })
      try {
        const pixels = await page.locator('.live-stage').screenshot()
        const uncovered = await page.evaluate(async png => {
          const image = new Image()
          image.src = 'data:image/png;base64,' + png
          await image.decode()
          const canvas = document.createElement('canvas')
          canvas.width = image.width
          canvas.height = image.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(image, 0, 0)
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
          let missing = 0
          for (let index = 0; index < data.length; index += 4) {
            if (data[index] === 255 && data[index + 1] === 0 && data[index + 2] === 255) missing++
          }
          return missing
        }, pixels.toString('base64'))
        expect(uncovered).toBe(0)
        console.log('Portrait uncovered rendered pixels:', uncovered)
      } finally {
        await marker.evaluate(node => node.remove())
      }
    }
    expect(await video.evaluate(element => element.srcObject === window.originalCameraStream)).toBe(true)
    expect(await page.locator('#surface-canvas').evaluate(canvas => canvas.parentElement.clientWidth)).toBeCloseTo(rect.width, 0)
    console.log(await panel.textContent())
    if (process.env.FRAMING_CAPTURE_DIR) {
      if (!process.env.EXPECT_SAFE_CROP) await expect(page.locator('#face')).toHaveText('已检测到', { timeout: 15000 })
      await page.locator('#controls-toggle').click()
      await page.locator('.live-room').screenshot({ path: `${process.env.FRAMING_CAPTURE_DIR}/${mode}.png` })
      await page.locator('#controls-toggle').click()
    }
    await info.attach(mode, { body: await panel.textContent(), contentType: 'text/plain' })
  }
  if (process.env.EXPECT_SAFE_CROP) {
    const position = () => video.evaluate(el => el.style.objectPosition)
    const initial = await position()
    await page.evaluate(() => { window.testSubjectShift = .13 })
    await expect(panel).toContainText('水平中心', { timeout: 15000 })
    await expect.poll(async () => (await panel.textContent()).match(/水平中心 ([\d.]+)%/)?.[1])
      .not.toBe('50.0')
    expect(await position()).toBe(initial)
    await page.locator('#reframe-camera').click()
    await expect.poll(position).not.toBe(initial)
    await expect(panel).toContainText('裁切已锁定')
    const locked = await position()
    await page.evaluate(() => { window.testSubjectShift = -.12 })
    await expect.poll(async () => Number((await panel.textContent()).match(/水平中心 ([\d.]+)%/)?.[1]))
      .toBeGreaterThan(75)
    expect(await position()).toBe(locked)
    expect(await video.evaluate(element => element.srcObject === window.originalCameraStream)).toBe(true)
    await expect(panel).toContainText(/渲染 [1-9]\d* FPS/)
    console.log((await panel.textContent()).split('\n').find(line => line.includes('视频帧间隔')))
  }
  await page.reload()
  await expect(page.locator('#controls-toggle')).toHaveAttribute('aria-expanded', 'false')
  await expect(selector).toHaveValue('portrait')
})
