import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { projectPoints } from '../src/projection.js'

const start = page => page.getByRole('button', { name: '开启摄像头' }).click()
const ready = page => expect(page.getByRole('button', { name: '关闭摄像头' })).toBeEnabled({ timeout: 30000 })
const metric = (info, data) => info.attach('measurements', { body: JSON.stringify(data), contentType: 'application/json' })

test.beforeEach(async ({ page, browser }, info) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.addInitScript(() => {
    window.__probe = { requests: [], tracks: [], frames: [], renders: [] }
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async options => {
      window.__probe.requests.push(options)
      const stream = await original(options)
      window.__probe.tracks.push(...stream.getTracks())
      return stream
    }
    window.__stage1Diagnostics = frame => window.__probe.frames.push({
      ...frame,
      points: window.__probe.capturePoints
        ? frame.points
        : undefined,
      count: frame.points?.length ?? 0,
      framing: window.__probe.capturePoints ? {
        mode: document.querySelector('#camera').dataset.fit || 'contain',
        position: Number.parseFloat(document.querySelector('#camera').style.objectPosition) / 100,
      } : undefined,
    })
    window.__stage1Render = stamp => window.__probe.renders.push(stamp)
  })
  await page.goto('/')
  await page.locator('#controls-toggle').click()
  await info.attach('browser-version', { body: browser.version(), contentType: 'text/plain' })
  page.__errors = errors
})

test.afterEach(async ({ page }, info) => {
  await info.attach('browser-errors', { body: JSON.stringify(page.__errors ?? []), contentType: 'application/json' })
})

test('A1 camera starts, advances, and releases tracks across restart', async ({ page }, info) => {
  const exceptions = []
  page.on('pageerror', error => exceptions.push(error.message))
  await expect(page.getByRole('main')).toBeVisible()
  for (let cycle = 0; cycle < 2; cycle++) {
    await start(page)
    await ready(page)
    await expect.poll(() => page.locator('video').evaluate(video => video.currentTime)).toBeGreaterThan(.2)
    const video = await page.locator('video').evaluate(element => ({
      width: element.videoWidth, height: element.videoHeight, time: element.currentTime,
    }))
    const requests = await page.evaluate(() => window.__probe.requests)
    await metric(info, { cycle: cycle + 1, ...video, requests: requests.length })
    expect(video.width * video.height).toBeGreaterThan(0)
    expect(requests).toHaveLength(cycle + 1)
    expect(requests[cycle].video.facingMode.ideal).toBe('user')
    await page.getByRole('button', { name: '关闭摄像头' }).click()
    expect(await page.evaluate(() => window.__probe.tracks.map(track => track.readyState)))
      .toEqual(Array(cycle + 1).fill('ended'))
    expect(await page.locator('video').evaluate(video => video.srcObject)).toBeNull()
  }
  expect(exceptions).toEqual([])
})

test('A2 denied permission gives a message and permits retry', async ({ page }, info) => {
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia
    navigator.mediaDevices.getUserMedia = () => {
      navigator.mediaDevices.getUserMedia = original
      throw new DOMException('Denied by test', 'NotAllowedError')
    }
  })
  await start(page)
  await expect(page.locator('#message')).toContainText('摄像头权限未获准')
  await metric(info, { message: await page.locator('#message').textContent() })
  await start(page)
  await ready(page)
})

test('E1 failed model download releases camera and permits retry', async ({ page }, info) => {
  await page.route('**/*.task', route => route.abort())
  await start(page)
  await expect(page.locator('#message')).toContainText('模型加载失败', { timeout: 30000 })
  const tracks = await page.evaluate(() => window.__probe.tracks.map(track => track.readyState))
  await metric(info, { tracks, message: await page.locator('#message').textContent() })
  expect(tracks).toEqual(['ended'])
  await page.unroute('**/*.task')
  await start(page)
  await ready(page)
})

test('D1 responsive video and canvas use the same viewport and mirror', async ({ page }, info) => {
  for (const width of [414, 320, 960]) {
    await page.setViewportSize({ width, height: 896 })
    const layout = await page.evaluate(() => {
      const video = document.querySelector('video')
      const canvas = document.querySelector('canvas')
      const css = getComputedStyle(video)
      return { video: video.getBoundingClientRect().toJSON(),
        canvas: canvas.getBoundingClientRect().toJSON(), fit: css.objectFit, mirror: css.transform }
    })
    await metric(info, { width, ...layout })
    expect(layout.video).toEqual(layout.canvas)
    expect(layout.video.width).toBe(Math.min(414, width))
    expect(layout.fit).toBe('cover')
    expect(layout.mirror).toBe('matrix(-1, 0, 0, 1, 0, 0)')
  }
})

test('E2 mobile viewport can start again after reload', async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  try {
    const page = await context.newPage()
    await page.goto(baseURL)
    await page.locator('#controls-toggle').click()
    expect(await page.getByRole('main').evaluate(el => el.clientWidth)).toBe(390)
    await start(page)
    await ready(page)
    await page.reload()
    await page.locator('#controls-toggle').click()
    await start(page)
    await ready(page)
    await metric(info, { viewport: '390x844', reinitialized: true })
  } finally {
    await context.close()
  }
})

const summarize = values => {
  const sorted = [...values].sort((a, b) => a - b)
  return { mean: values.reduce((sum, v) => sum + v, 0) / values.length,
    p95: sorted[Math.ceil(sorted.length * .95) - 1], max: sorted.at(-1) }
}

test('C1 desktop synthetic camera sustains 120 seconds', async ({ page }, info) => {
  await start(page)
  await ready(page)
  await page.waitForFunction(() => window.__probe.frames.length >= 5)
  await page.waitForTimeout(120000)
  const { frames, renders } = await page.evaluate(() => window.__probe)
  const interval = frames.slice(1).map((frame, i) => frame.time - frames[i].time)
  const seconds = (frames.at(-1).time - frames[0].time) / 1000
  const updates = interval.length / seconds
  const renderFps = (renders.length - 1) * 1000 / (renders.at(-1) - renders[0])
  const segment = (start, end) => frames.filter(frame => frame.time >= end - 30000 && frame.time <= end && frame.time >= start).length / 30
  const initial = segment(frames[0].time, frames[0].time + 30000)
  const final = segment(frames[0].time, frames.at(-1).time)
  const tailGap = renders.at(-1) - frames.at(-1).time
  await metric(info, { seconds, updates, renderFps, intervalMs: summarize(interval),
    inferenceMs: summarize(frames.map(frame => frame.inferenceMs)), initial, final, tailGap })
  await ready(page)
  expect.soft(seconds).toBeGreaterThanOrEqual(120)
  expect.soft(updates).toBeGreaterThanOrEqual(30)
  expect.soft(Math.max(...interval, tailGap)).toBeLessThanOrEqual(1000)
  expect.soft(final).toBeGreaterThanOrEqual(initial * .8)
})

async function recordedFrames(page) {
  const fixture = JSON.parse(readFileSync(process.env.STAGE1_MANIFEST, 'utf8'))
  await page.evaluate(() => { window.__probe.capturePoints = true })
  await start(page)
  await ready(page)
  const end = fixture.samples.at(-1).time
  await page.waitForFunction(end => window.__probe.frames.at(-1)?.videoTime >= end + .1, end,
    { timeout: Math.ceil((end + 5) * 1000) })
  const result = await page.evaluate(() => ({
    frames: window.__probe.frames,
    viewport: document.querySelector('canvas').getBoundingClientRect().toJSON(),
  }))
  const pairs = fixture.samples.map(sample => ({
    sample,
    frame: result.frames.reduce((best, next) =>
      Math.abs(next.videoTime - sample.time) < Math.abs(best.videoTime - sample.time) ? next : best),
  }))
  expect(pairs.every(({ sample, frame }) => Math.abs(sample.time - frame.videoTime) <= .075)).toBe(true)
  return { ...result, pairs }
}

test('B1 MediaPipe initializes and processes video', async ({ page }, info) => {
  await start(page)
  await ready(page)
  await page.waitForFunction(() => window.__probe.frames.length >= 3)
  const frames = await page.evaluate(() => window.__probe.frames.slice(0, 3))
  await metric(info, { processed: frames.length, width: frames[0].width, height: frames[0].height,
    inferenceMs: frames.map(frame => frame.inferenceMs) })
  expect(frames.every(frame => Number.isFinite(frame.inferenceMs))).toBe(true)
})

test('B7 annotated sequence detects, clears, and reacquires landmarks', async ({ page }, info) => {
  test.skip(!process.env.STAGE1_MANIFEST, '缺少合法授权且人工标注的视频')
  const { pairs, frames } = await recordedFrames(page)
  const front = pairs.filter(({ sample }) => sample.scene === 'front')
  const rate = front.filter(({ frame }) => frame.count > 0).length / front.length
  const invalid = frames.filter(({ points }) => points &&
    (points.length !== 478 || !points.every(p => [p.x, p.y, p.z].every(Number.isFinite))))
  const lost = pairs.filter(({ sample }) => sample.scene === 'absent')
  const recovered = pairs.filter(({ sample }) => sample.scene === 'return')
  const motion = pairs.filter(({ sample }) => ['move', 'turn'].includes(sample.scene))
  const distinctNosePositions = new Set(motion.filter(({ frame }) => frame.points)
    .map(({ frame }) => `${frame.points[1].x.toFixed(3)},${frame.points[1].y.toFixed(3)}`)).size
  await metric(info, { frontSamples: front.length, rate, invalid: invalid.length,
    lost: lost.length, recovered: recovered.length, distinctNosePositions })
  expect.soft(rate).toBeGreaterThanOrEqual(.95)
  expect.soft(invalid).toHaveLength(0)
  expect.soft(lost.every(({ frame }) => !frame.count)).toBe(true)
  expect.soft(recovered.every(({ frame }) => frame.count > 0)).toBe(true)
  expect.soft(distinctNosePositions).toBeGreaterThan(1)
})

test('D4 annotated landmarks meet normalized screen alignment target', async ({ page }, info) => {
  test.skip(!process.env.STAGE1_MANIFEST, '缺少人工标注，精度未验证')
  const { pairs, viewport } = await recordedFrames(page)
  const errors = []
  const residuals = []
  for (const { sample, frame } of pairs.filter(({ sample }) => sample.points?.length)) {
    expect(frame.points, `Missing face at ${sample.time}s`).toBeDefined()
    const mode = frame.framing?.mode ?? 'contain'
    const scale = (mode === 'contain' ? Math.min : Math.max)(viewport.width / frame.width, viewport.height / frame.height)
    const faceSize = Math.hypot(sample.box.width * frame.width, sample.box.height * frame.height) * scale
    const predictions = projectPoints(frame.points, viewport.width, viewport.height, frame.width, frame.height, mode)
    for (const point of sample.points) {
      // Independent pixel-space oracle for the authored normalized annotations.
      const x = viewport.width - (point.x * frame.width * scale + (viewport.width - frame.width * scale) * (frame.framing?.position ?? .5))
      const y = point.y * frame.height * scale + (viewport.height - frame.height * scale) / 2
      const dx = (predictions[point.index].x - x) / faceSize
      const dy = (predictions[point.index].y - y) / faceSize
      errors.push(Math.hypot(dx, dy))
      residuals.push([dx, dy])
    }
  }
  const measured = summarize(errors)
  const bias = Math.hypot(...[0, 1].map(axis => residuals.reduce((sum, v) => sum + v[axis], 0) / residuals.length))
  await metric(info, { count: errors.length, ...measured, bias })
  expect.soft(measured.mean).toBeLessThanOrEqual(.05)
  expect.soft(bias).toBeLessThanOrEqual(.05)
})
