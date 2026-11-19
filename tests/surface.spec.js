import { crownFixture, crownScenarios, holdoutCrowns } from './face-fixture.js'
import { test, expect, chromium } from '@playwright/test'
const fixture = process.env.STAGE1_SURFACE_VIDEO || process.env.STAGE1_FACE_VIDEO
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  ...(fixture ? [`--use-file-for-fake-video-capture=${fixture}`] : [])] } })
test('surface models process real pixels and clear the interaction on stop', async ({ page }, info) => {
  test.skip(!fixture, '缺少模拟摄像头素材')
  await page.addInitScript(() => {
    window.spawnedDrops = []
    window.__surfaceSpawn = sample => window.spawnedDrops.push(sample)
    window.surfaceFrames = []
    window.__surfaceDiagnostics = result => window.surfaceFrames.push(result)
    window.__surfacePhysics = result => { window.surfacePhysics = result }
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.locator('#controls-toggle').click()
  await page.getByRole('button', { name: '开启摄像头' }).click()
  await expect(page.getByRole('button', { name: '关闭摄像头' })).toBeEnabled({ timeout: 30000 })
  await page.locator('#surface-enabled').check()
  await page.waitForFunction(() => window.surfaceFrames.length > 0
    || /失败/.test(document.querySelector('#surface-status').textContent), null, { timeout: 90000 })
  await expect(page.locator('#surface-status')).not.toContainText('失败')
  await page.locator('#head-collision-debug').check()
  await expect(page.locator('#head-collision-stats')).toContainText('Active')
  const release = page.locator('#surface-spawn')
  // A drop can still be in flight when the looping clip briefly loses the subject.
  await expect(async () => {
    await expect(release).toBeEnabled({ timeout: 5000 })
    await release.click()
    await page.waitForFunction(() => window.surfacePhysics?.attached > 0, null, { timeout: 3500 })
  }).toPass({ timeout: 25000 })
  await page.waitForFunction(() => window.surfacePhysics?.attached > 0, null, { timeout: 15000 })
  await page.waitForFunction(() => window.surfacePhysics?.detached > 0, null, { timeout: 15000 })
  await info.attach('head-collision-normal', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  await info.attach('head-collision-stats', { body: await page.locator('#head-collision-stats').textContent(), contentType: 'text/plain' })
  await info.attach('surface-measurements', { body: JSON.stringify(await page.evaluate(() => ({
    frames: window.surfaceFrames, physics: window.surfacePhysics,
  }))), contentType: 'application/json' })
  const samples = await page.evaluate(() => window.spawnedDrops)
  expect(samples.length).toBeGreaterThan(1)
  expect(samples.every(sample => sample.y === -4 && sample.x >= 0 && sample.x < sample.width)).toBe(true)
  expect(new Set(samples.map(sample => sample.time)).size).toBeGreaterThan(1)
  expect(new Set(samples.map(sample => sample.x)).size).toBeGreaterThan(1)
  await page.locator('#broadcast-format').selectOption('landscape')
  await page.evaluate(() => { window.spawnedDrops = [] })
  await expect(page.locator('#surface-spawn')).toBeEnabled({ timeout: 30000 })
  await page.locator('#surface-spawn').click()
  await page.waitForFunction(() => window.spawnedDrops.length > 0)
  const [landscapeDrop] = await page.evaluate(() => window.spawnedDrops)
  expect(landscapeDrop.stageTop).toBeGreaterThan(0)
  expect(landscapeDrop.y).toBe(-4)
  await page.getByRole('button', { name: '关闭摄像头' }).click()
  await expect(page.locator('#surface-spawn')).toBeDisabled()
  const painted = await page.locator('#surface-canvas').evaluate(c =>
    c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some(value => value))
  expect(painted).toBe(false)
  expect(errors).toEqual([])
})

test('records surface quality evidence from the composed effect layer', async ({ page }, info) => {
  test.skip(!fixture, '缺少可重复摄像头素材')
  await page.addInitScript(() => {
    window.qualityFrames = []
    window.crownContacts = []
    window.__surfaceQuality = frame => window.qualityFrames.push(frame)
    window.__surfaceCollision = event => window.crownContacts.push(event)
  })
  await page.goto('/')
  await page.locator('#controls-toggle').click()
  await page.getByRole('button', { name: '开启摄像头' }).click()
  await expect(page.getByRole('button', { name: '关闭摄像头' })).toBeEnabled({ timeout: 30000 })
  await page.locator('#surface-enabled').check()
  await page.locator('#surface-debug').uncheck()
  const release = page.locator('#surface-spawn')
  try {
    await expect(release).toBeEnabled({ timeout: 90000 })
  } finally {
    const readiness = await page.evaluate(() => ({
      camera: { width: document.querySelector('video').videoWidth, time: document.querySelector('video').currentTime },
      surfaceStatus: document.querySelector('#surface-status').textContent,
      sampledFrames: window.qualityFrames.length,
      surfaceModelRequests: performance.getEntriesByType('resource')
        .filter(entry => /surface-worker|perception.worker/.test(entry.name)).map(entry => ({
          duration: entry.duration, responseStatus: entry.responseStatus,
        })),
    }))
    await info.attach('surface-release-readiness', { body: JSON.stringify(readiness), contentType: 'application/json' })
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    await expect(release).toBeEnabled({ timeout: 15000 })
    await release.click()
    await page.waitForTimeout(1500)
    if (await page.evaluate(() => window.qualityFrames.filter(f => f.coverage && f.drops).length >= 15
      && window.crownContacts.length > 0)) break
  }
  const evidence = await page.evaluate(() => ({ frames: window.qualityFrames, contacts: window.crownContacts }))
  await info.attach('surface-quality', { body: JSON.stringify(evidence), contentType: 'application/json' })
  expect(evidence.frames.some(frame => frame.coverage && frame.drops)).toBe(true)
  expect(evidence.frames.filter(frame => frame.coverage).every(frame => frame.coverage.maxAlpha === 0)).toBe(true)
  await page.locator('#face-mask-debug').check()
  await expect(page.locator('#face-mask-stats')).toContainText('核心 Alpha 峰值 0')
  await info.attach('face-mask-debug', { body: await page.screenshot(), contentType: 'image/png' })
})


for (const distance of crownScenarios) {
  test.describe(`head collision · ${distance}`, () => {
    const video = process.env['STAGE1_HEAD_' + distance.toUpperCase()]
    test(`reports crown availability · ${distance}`, async ({ baseURL, channel, viewport }, info) => {
      test.skip(!video, '缺少头顶距离测试素材')
      const browser = await chromium.launch({ channel, args: [
        '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-video-capture=${video}`,
      ] })
      try {
        const page = await browser.newPage({ baseURL, viewport })
        await page.addInitScript(({ distance, visibleCrown, zoom, top }) => {
          window.__crownReport = null
          window.__crownTestDone = result => { window.__crownReport = result }
          window.__crownReference = video => {
            if (distance === 'clipped' || !video.videoWidth) return []
            const left = (video.videoWidth - Math.round(150 * zoom)) / 2
            const rect = video.getBoundingClientRect()
            const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight)
            return visibleCrown.map(([x, y]) => ({
              x: rect.width / 2 + (video.videoWidth / 2 - left - x * zoom) * scale,
              y: rect.height / 2 + (top + y * zoom - video.videoHeight / 2) * scale,
            })).reverse()
          }
        }, { distance, visibleCrown: holdoutCrowns[distance]?.reference ?? crownFixture.visibleCrown,
          ...(holdoutCrowns[distance] ?? crownFixture.placements[distance]) })
        await page.goto('/')
        await page.locator('#controls-toggle').click()
        await page.getByRole('button', { name: '开启摄像头' }).click()
        await expect(page.getByRole('button', { name: '关闭摄像头' })).toBeEnabled({ timeout: 30000 })
        await page.locator('#surface-enabled').check()
        await page.locator('#surface-debug').uncheck()
        await page.locator('#head-collision-debug').check()
        const stats = page.locator('#head-collision-stats')
        try {
          await expect(stats).toContainText(distance === 'clipped' ? '头顶接触采集或显示上边缘' : /^Active/, { timeout: 90000 })
          await page.getByText('Crown Collision Test', { exact: true }).click()
          const scenario = distance === 'holdout-normal' ? 'normal' : distance === 'holdout-tilt' ? 'tilt' : distance
          await page.locator('#crown-test-scenario').selectOption(scenario)
          await page.locator('#crown-test-start').click()
          await expect(page.locator('#crown-test-start')).toHaveText('停止测试')
          await page.locator('#crown-test-review').click()
          await page.waitForFunction(() => window.__crownReport !== null, null, { timeout: 26000 })
          const result = await page.evaluate(() => window.__crownReport)
          expect(result.anomalyFrames.some(frame => frame.kind === 'manual-review' && frame.compositeImage)).toBe(true)
          await info.attach('crown-specialized', { body: JSON.stringify(result), contentType: 'application/json' })
          const downloadPromise = page.waitForEvent('download')
          await page.locator('#crown-test-export').click()
          expect((await downloadPromise).suggestedFilename()).toBe(`crown-${scenario}.json`)
          if (distance === 'clipped') {
            expect(result.eligible).toBe(0)
            expect(result.frames.some(frame => !frame.active && frame.inactiveReason?.includes('边缘'))).toBe(true)
          } else expect(result.eligible).toBeGreaterThanOrEqual(50)
        } finally {
          await info.attach('head-collision-stats', { body: await stats.textContent(), contentType: 'text/plain' })
          await info.attach('head-collision-debug', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
        }
      } finally {
        await browser.close()
      }
    })
  })
}
