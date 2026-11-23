import { test, expect } from '@playwright/test'

const openControls = async (page) => {
  await page.locator('#controls-toggle').click()
  await page.locator('#visual-rain > summary').click()
}

test('default renderer uses the downloaded effect, emits random colors and drains to transparency', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const canvas = page.locator('canvas[data-visual-version="starvoid-sprite"]')
  await expect(canvas).toHaveCount(1)
  await openControls(page)
  const fire = page.getByRole('button', { name: '测试烟花（占位）' })
  await fire.click()
  await expect(canvas).toHaveAttribute('data-trigger-count', '1')
  const firstHue = Number(await canvas.getAttribute('data-last-hue'))
  await page.waitForTimeout(1600)
  expect(
    await canvas.evaluate((c) =>
      c
        .getContext('2d')
        .getImageData(0, 0, c.width, c.height)
        .data.some((v, i) => i % 4 === 3 && v > 0),
    ),
  ).toBe(true)
  await fire.click()
  const secondHue = Number(await canvas.getAttribute('data-last-hue'))
  expect(firstHue).toBeGreaterThanOrEqual(0)
  expect(firstHue).toBeLessThan(360)
  expect(secondHue).not.toBe(firstHue)
  await expect(canvas).toHaveAttribute('data-active-count', '0', {
    timeout: 12000,
  })
  // The last trails are cleared three frames after the final entity expires.
  await expect
    .poll(() =>
      canvas.evaluate((c) =>
        c
          .getContext('2d')
          .getImageData(0, 0, c.width, c.height)
          .data.some((value, index) => index % 4 === 3 && value > 0),
      ),
    )
    .toBe(false)
  expect(errors).toEqual([])
})

test('laugh schedules the new effect, face loss stops repeats and pagehide removes the canvas', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate(async () => {
    const video = document.querySelector('#camera')
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true })
    await video.play()
    const { expressions } = await import('/src/expression/panel.js')
    window.setTestExpression = (state) => {
      expressions.snapshot.faceDetected = state !== 'NO_FACE'
      expressions.snapshot.timestamp = performance.now()
      expressions.transition(state, performance.now())
    }
    window.setTestExpression('LAUGH')
    window.laughTimer = setInterval(
      () => window.setTestExpression('LAUGH'),
      100,
    )
  })
  const canvas = page.locator('canvas[data-visual-version="starvoid-sprite"]')
  await expect(canvas).toHaveAttribute('data-source', 'laugh')
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-trigger-count')))
    .toBeGreaterThanOrEqual(2)
  await page.evaluate(() => {
    clearInterval(window.laughTimer)
    window.setTestExpression('NO_FACE')
  })
  const count = await canvas.getAttribute('data-trigger-count')
  await expect(canvas).toHaveAttribute('data-active-count', '0', {
    timeout: 12000,
  })
  await page.waitForTimeout(1400)
  await expect(canvas).toHaveAttribute('data-trigger-count', count)
  await page.evaluate(() => {
    document
      .querySelector('#camera')
      .srcObject.getTracks()
      .forEach((track) => track.stop())
    window.dispatchEvent(new Event('pagehide'))
  })
  await expect(canvas).toHaveCount(0)
})

test('bounds rapid launches, caps DPR and does not repaint while idle', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  })
  const page = await context.newPage()
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { createSpriteFirework } = await import(
      '/src/firework/sprite-firework.js'
    )
    const canvas = document.createElement('canvas')
    const effect = createSpriteFirework(canvas)
    effect.resize(390, 844, 3)
    let accepted = 0
    for (let i = 0; i < 100; i++) if (effect.launch()) accepted++
    let maxSparks = 0
    for (let frame = 0; frame < 1000; frame++) {
      effect.step(frame * 16.667)
      maxSparks = Math.max(maxSparks, effect.stats.sparks)
    }
    const ctx = canvas.getContext('2d')
    let clears = 0
    let fills = 0
    const clear = ctx.clearRect.bind(ctx),
      fill = ctx.fillRect.bind(ctx)
    ctx.clearRect = (...args) => {
      clears++
      clear(...args)
    }
    ctx.fillRect = (...args) => {
      fills++
      fill(...args)
    }
    for (let frame = 1000; frame < 1120; frame++) effect.step(frame * 16.667)
    const pixels = [canvas.width, canvas.height]
    const playing = effect.playing
    const idleDraws = clears + fills
    effect.dispose()
    return {
      accepted,
      maxSparks,
      pixels,
      playing,
      idleDraws,
      cacheSize: effect.stats.sprites,
    }
  })
  expect(result.accepted).toBe(4)
  expect(result.maxSparks).toBeLessThanOrEqual(1600)
  expect(result.pixels).toEqual([780, 1688])
  expect(result.playing).toBe(false)
  expect(result.idleDraws).toBe(0)
  expect(result.cacheSize).toBe(0)
  await context.close()
})

test('preserves original drawing except explicitly removed shockwave rings', async ({
  browser,
}) => {
  const { readFile } = await import('node:fs/promises')
  const original = await readFile(
    new URL('../previews/starvoid-6laZc.html', import.meta.url),
    'utf8',
  )
  const random = `let seed = 12345; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);`
  const reference =
    original
      .split('  // ---- 控制 ----')[0]
      .replace("let themeName = 'liujin';", "let themeName = 'nihong';")
      .replace('100%,58%,.42', '100%,58%,.16')
      .replace('100%,60%,.5', '100%,60%,.20')
      .replace(
        'const a = Math.pow(1 - k, 2.2);',
        'const a = Math.pow(1 - k, 2.2) * 0.55;',
      )
      .replace(/^\s*rings\.push\([^\n]*\);[ \t]*$/gm, '')
      .replace(/    \/\/ 冲击波环[\s\S]*?(?=    \/\/ 火花:)/, '')
      .replaceAll(',100%,', ',30%,')
      .replaceAll(',95%,', ',30%,')
      .replaceAll(',90%,', ',30%,')
      .replace('    requestAnimationFrame(frame);', '')
      .replace('  requestAnimationFrame(frame);', '') +
    '\nwindow.reference = { launch: launchRocket, step: frame };})();</script></body></html>'
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
  })
  const frames = []
  for (const source of ['reference', 'adapted']) {
    const page = await context.newPage()
    if (source === 'reference') {
      await page.addInitScript(random)
      await page.goto('/')
      await page.setContent(reference.replace('<script>', `<script>${random}`))
    } else await page.goto('/')
    frames.push(
      await page.evaluate(
        async ({ source, random }) => {
          const output = []
          let effect, canvas
          if (source === 'reference') {
            effect = window.reference
            canvas = document.querySelector('#fx canvas')
          } else {
            const { createSpriteFirework } = await import(
              '/src/firework/sprite-firework.js'
            )
            canvas = document.createElement('canvas')
            effect = createSpriteFirework(canvas)
            effect.resize(414, 896, 2)
            eval(random)
          }
          effect.launch()
          for (let frame = 0; frame <= 80; frame++) {
            effect.step(frame * 16.667)
            if ([0, 30, 65, 80].includes(frame)) output.push(canvas.toDataURL())
          }
          effect.dispose?.()
          return output
        },
        { source, random },
      ),
    )
    await page.close()
  }
  expect(frames[1]).toEqual(frames[0])
  await context.close()
})


test('all explosion types retain particles, trails and fading without shockwave arcs', async ({page}) => {
 await page.goto('/')
 const result=await page.evaluate(async()=>{
  const {createSpriteFirework}=await import('/src/firework/sprite-firework.js')
  const results=[]
  for(const type of ['peony','chrys','ring','double','willow','strobe']){
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');let arcs=0,images=0,strokes=0,erases=0
   const arc=ctx.arc.bind(ctx),image=ctx.drawImage.bind(ctx),stroke=ctx.stroke.bind(ctx),fill=ctx.fillRect.bind(ctx)
   ctx.arc=(...args)=>{arcs++;return arc(...args)}
   ctx.drawImage=(...args)=>{images++;return image(...args)}
   ctx.stroke=(...args)=>{strokes++;return stroke(...args)}
   ctx.fillRect=(...args)=>{if(ctx.globalCompositeOperation==='destination-out'&&ctx.fillStyle==='rgba(0, 0, 0, 0.25)')erases++;return fill(...args)}
   const effect=createSpriteFirework(canvas);effect.resize(414,896,1);effect.launch(207,250,{type,size:1,hue:270});let peak=0
   for(let frame=0;frame<500;frame++){effect.step(frame*16.667);peak=Math.max(peak,effect.stats.sparks)}
   results.push({type,arcs,images,strokes,erases,peak,playing:effect.playing});effect.dispose()
  }
  return results
 })
 for(const r of result){expect(r.arcs,r.type).toBe(0);expect(r.images,r.type).toBeGreaterThan(0);expect(r.strokes,r.type).toBeGreaterThan(0);expect(r.erases,r.type).toBeGreaterThan(0);expect(r.peak,r.type).toBeGreaterThan(0);expect(r.playing,r.type).toBe(false)}
})
