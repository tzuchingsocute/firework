import { expect, test } from '@playwright/test'
import { sequence } from './face-fixture.js'

const videoPath = process.env.STAGE1_FACE_VIDEO
test.use({ launchOptions: { args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  ...(videoPath ? [`--use-file-for-fake-video-capture=${videoPath}`] : []),
] } })

let context
let page
let samples
let sequenceError
const browserErrors = []

test.beforeAll(async ({ browser, baseURL }) => {
  if (!videoPath) return
  context = await browser.newContext({ baseURL, viewport: { width: 414, height: 896 } })
  page = await context.newPage()
  page.on('pageerror', error => browserErrors.push(error.message))
  page.on('console', event => { if (event.type() === 'error') browserErrors.push(event.text()) })
  try {
    await page.addInitScript(({ seconds }) => {
      window.faceSamples = []
      let lastSample = -1
      window.__stage1Diagnostics = ({ videoTime, points }) => {
        const phase = videoTime % seconds
        const sample = { time: videoTime, phase, count: points?.length ?? 0,
          valid: points?.every(point => [point.x, point.y, point.z].every(Number.isFinite)),
          nose: points?.[1]?.x, painted: null, status: document.querySelector('#tracking').textContent }
        if (videoTime - lastSample >= .25) {
          const canvas = document.querySelector('#landmarks')
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
          sample.painted = pixels.some((value, index) => index % 4 === 3 && value > 0)
          lastSample = videoTime
        }
        window.faceSamples.push(sample)
      }
    }, sequence)
    await page.goto('/')
    await page.locator('#controls-toggle').click()
    await page.getByRole('button', { name: '开启摄像头' }).click()
    await expect(page.getByRole('button', { name: '关闭摄像头' })).toBeEnabled({ timeout: 30000 })
    await page.waitForFunction(end => window.faceSamples.at(-1)?.time >= end, sequence.seconds * 2, { timeout: 40000 })
    samples = await page.evaluate(({ seconds }) =>
      window.faceSamples.filter(sample => sample.time >= seconds && sample.time < seconds * 2), sequence)
  } catch (error) {
    sequenceError = error.message
  }
})

test.afterAll(() => context?.close())

async function measured(info, getMeasurements) {
  test.skip(!videoPath, '缺少许可明确的可重复人脸素材')
  await info.attach('browser-errors', { body: JSON.stringify(browserErrors), contentType: 'application/json' })
  if (!samples) {
    if (page) await info.attach('sequence-failure', { body: await page.screenshot(), contentType: 'image/png' })
    throw new Error(sequenceError ?? '未获得相机序列')
  }
  const data = getMeasurements()
  await info.attach('measurements', { body: JSON.stringify(data), contentType: 'application/json' })
  return data
}

const phase = (start, end) => samples.filter(sample => sample.phase >= start && sample.phase < end)
const positive = () => phase(.5, 3.8)

test('B2 model outputs the expected 478 landmarks', async ({}, info) => {
  const data = await measured(info, () => {
    const frames = positive()
    return { sampled: frames.length, detected: frames.filter(frame => frame.count).length,
      wrongCount: frames.filter(frame => frame.count && frame.count !== 478).length }
  })
  expect(data.sampled).toBeGreaterThanOrEqual(20)
  expect(data.detected / data.sampled).toBeGreaterThanOrEqual(.95)
  expect(data.wrongCount).toBe(0)
})

test('B3 landmark coordinates are finite', async ({}, info) => {
  const data = await measured(info, () => ({
    detected: samples.filter(frame => frame.count).length,
    invalid: samples.filter(frame => frame.count && !frame.valid).length,
  }))
  expect(data.detected).toBeGreaterThan(0)
  expect(data.invalid).toBe(0)
})

test('B4 consecutive outputs follow both directions of motion', async ({}, info) => {
  const data = await measured(info, () => {
    const mean = frames => frames.reduce((sum, frame) => sum + frame.nose, 0) / frames.length
    const right = phase(8.7, 9.3).filter(frame => frame.count)
    const left = phase(10.7, 11.3).filter(frame => frame.count)
    const center = phase(7.5, 7.9).filter(frame => frame.count)
    return { right: mean(right), left: mean(left), center: mean(center),
      frameCounts: [right.length, left.length, center.length] }
  })
  expect(Math.min(...data.frameCounts)).toBeGreaterThanOrEqual(3)
  expect(data.right - data.center).toBeGreaterThan(.05)
  expect(data.center - data.left).toBeGreaterThan(.05)
})

test('B5 absent face clears actual canvas pixels and detection status', async ({}, info) => {
  const data = await measured(info, () => {
    const absent = phase(4.5, 6.9)
    return { priorPainted: positive().filter(frame => frame.painted).length,
      absent: absent.length, sampledCanvas: absent.filter(frame => frame.painted !== null).length,
      stale: absent.filter(frame => frame.count || frame.painted || frame.status !== '正在寻找人脸').length }
  })
  expect(data.priorPainted).toBeGreaterThan(0)
  expect(data.absent).toBeGreaterThanOrEqual(10)
  expect(data.sampledCanvas).toBeGreaterThan(0)
  expect(data.stale).toBe(0)
})

test('B6 returning face restores tracking and painted landmarks', async ({}, info) => {
  const data = await measured(info, () => ({
    absent: phase(5, 6.9).filter(frame => frame.count === 0).length,
    detected: phase(7.15, 8).filter(frame => frame.count === 478 && frame.status === '追踪中').length,
    painted: phase(7.15, 8).filter(frame => frame.painted).length,
  }))
  expect(data.absent).toBeGreaterThan(0)
  expect(data.detected).toBeGreaterThanOrEqual(3)
  expect(data.painted).toBeGreaterThan(0)
})

test('alignment debug freezes one frame, maps zoomed marks, and exports coordinates', async ({}, info) => {
  await measured(info, () => ({ fixture: 'simulated portrait; UI interaction only' }))
  await page.locator('#debug').check()
  await page.waitForFunction(() => {
    const phase = document.querySelector('video').currentTime % 12
    return phase > 1 && phase < 3 && document.querySelector('#tracking').textContent === '追踪中'
  }, null, { timeout: 15000 })
  await page.getByRole('button', { name: '暂停并标注' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  expect(await page.locator('video').evaluate(video => video.paused)).toBe(true)
  const canvas = dialog.locator('canvas')
  const coords = [[175, 120], [235, 120], [205, 145], [180, 180], [230, 180]]
  const names = ['左眼外眼角', '右眼外眼角', '鼻尖', '左嘴角', '右嘴角']
  for (const [index, name] of names.entries()) {
    await dialog.getByRole('button', { name, exact: true }).click()
    const [x, y] = coords[index]
    await canvas.click({ position: { x, y } })
  }
  await dialog.getByText('显示预测', { exact: true }).check()
  await expect(dialog.locator('#alignment-result')).toContainText('60.0 px')
  const zoom = dialog.locator('#alignment-zoom')
  await zoom.focus()
  await zoom.press('ArrowRight')
  await expect(canvas).toHaveCSS('width', '517.5px')
  const mark = await canvas.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { x: rect.x + 205 * 1.25, y: rect.y + 145 * 1.25 }
  })
  await page.mouse.move(mark.x, mark.y)
  await page.mouse.down()
  await page.mouse.move(mark.x + 10, mark.y + 5)
  await page.mouse.up()
  // The fixture exercises the export UI only. Never pass its file to the scoring runner.
  await dialog.locator('#alignment-real').check()
  await dialog.getByRole('button', { name: '保存场景' }).click()
  const downloadEvent = page.waitForEvent('download')
  await dialog.getByRole('button', { name: '导出 JSON' }).click()
  const download = await downloadEvent
  const file = await download.createReadStream()
  let json = ''
  for await (const chunk of file) json += chunk
  const data = JSON.parse(json)
  expect(data.summary.complete).toBe(false)
  expect(data.samples.front.reference.nose.x).toBeCloseTo(213, 0)
  await dialog.getByRole('button', { name: '返回实时画面' }).click()
  await expect.poll(() => page.locator('video').evaluate(video => video.paused)).toBe(false)
})

test('head space tracks motion, clears collision when lost, and recovers', async ({}, info) => {
  await measured(info, () => ({ fixture: 'simulated portrait; no real device credit' }))
  await page.locator('#debug').check()
  await page.locator('#collision-enabled').check()
  const seed = page.getByRole('button', { name: '重置周围粒子' })
  const stats = page.locator('#head-space')
  await expect(seed).toBeEnabled({ timeout: 15000 })
  await expect(stats).toContainText('Head X / Y')
  await page.waitForFunction(() => {
    const match = document.querySelector('#head-space').textContent.match(/受影响粒子 (\d+)/)
    return Number(match?.[1]) > 0
  }, undefined, { timeout: 15000 })
  const movementMetrics = await stats.textContent()
  await expect(seed).toBeDisabled({ timeout: 15000 })
  await expect(stats).toHaveText('等待头部追踪')
  expect(await page.locator('#collision-preview').evaluate(canvas =>
    canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.every(v => !v))).toBe(true)
  await expect(seed).toBeEnabled({ timeout: 15000 })
  await expect(stats).toContainText('追踪中')
  await info.attach('head-space-observation', { body: movementMetrics, contentType: 'text/plain' })
  await page.locator('#collision-enabled').uncheck()
})
