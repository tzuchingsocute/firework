import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

test('uses the approved preset after reload and keeps the console focused on interactions', async ({ page }) => {
  const expected = {
    density: 142, core: 1.45, glow: 0.52, trail: 1.95, trailOpacity: 0.45,
    speed: 0.21, variation: 0.59, drift: 7, strands: 17, lengthVariation: 1, buildup: 8.5,
  }
  await page.goto('/')
  const panel = page.locator('#visual-rain')
  for (let run = 0; run < 2; run++) {
    await page.locator('#controls-toggle').click()
    await panel.locator(':scope > summary').click()
    await expect(panel.locator('[data-rain-preset]')).toHaveText('Luminous Rain — Approved Preset')
    await expect(panel.locator('[data-effective-speed]')).toContainText('188.2')
    await expect(panel.locator('input[type=range]')).toHaveCount(0)
    await expect(page.locator('#needle-lab')).toHaveCount(0)
    const pending = page.waitForEvent('download')
    await panel.locator('[data-export]').click()
    const download = await pending
    expect(JSON.parse(await readFile(await download.path(), 'utf8'))).toEqual(expected)
    if (!run) await page.reload()
  }
  await page.locator('#broadcast-format').selectOption('landscape')
  await panel.locator('[data-rain-mode]').selectOption('interactive')
  await panel.locator('#hand-interaction summary').click()
  const hand = panel.locator('[data-hand-enabled]')
  await expect(hand).toBeChecked()
  await hand.uncheck()
  await panel.locator('[data-rain-mode]').selectOption('visual')
  await panel.locator('[data-rain-mode]').selectOption('interactive')
  await expect(hand).not.toBeChecked()
  await expect(panel.locator('[data-hand-state]')).toHaveText('已停用')
  await panel.locator('[data-play]').click()
  await expect(panel.locator('[data-effective-speed]')).toContainText('48.9')
})

test('captures trail length changes at a fixed time and random seed', async ({ page }) => {
  const baseline = process.env.RAIN_TRAIL_BASELINE
  if (baseline) {
    const source = await readFile(baseline, 'utf8')
    await page.route('**/src/rain/droplet-appearance.js*', route => route.fulfill({
      contentType: 'application/javascript', body: source,
    }))
  }
  const spriteBaseline = process.env.RAIN_TRAIL_SPRITE_BASELINE
  if (spriteBaseline) {
    const source = await readFile(spriteBaseline, 'utf8')
    await page.route('**/src/rain/needle-sprite.js*', route => route.fulfill({
      contentType: 'application/javascript', body: source,
    }))
  }
  await page.addInitScript(() => {
    let seed = 1201
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
  })
  await page.clock.install()
  await page.goto(process.env.RAIN_AR_DEV_URL ?? '/')
  await page.locator('#controls-toggle').click()
  const panel = page.locator('#visual-rain')
  await panel.locator(':scope > summary').click()
  await panel.locator('[data-play]').click()
  await page.clock.runFor(10600)
  await panel.locator('[data-pause]').click()
  await expect(panel.locator('[data-effective-speed]')).toContainText('188.2')
  await page.locator('.live-room').screenshot({path: `reports/rain-trails-${baseline ? 'before' : 'after'}.png`})
})
