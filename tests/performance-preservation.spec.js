import { test, expect } from '@playwright/test'

test.skip(!process.env.RAIN_AR_DEV_URL, 'Requires Vite source modules through RAIN_AR_DEV_URL')

test('idle fireworks preserve a blank canvas without repeatedly clearing it', async ({ page }) => {
  await page.goto(process.env.RAIN_AR_DEV_URL)
  const result = await page.evaluate(async () => {
    window.dispatchEvent(new Event('pagehide'))
    const { mountFirework } = await import('/src/firework/controller.js')
    const request = window.requestAnimationFrame
    const cancel = window.cancelAnimationFrame
    let next
    window.requestAnimationFrame = callback => { next = callback; return 1 }
    window.cancelAnimationFrame = () => {}
    const controller = mountFirework({ snapshot: { state: 'NEUTRAL', timestamp: 0 } })
    const canvas = document.querySelector('[data-renderer="live-particles"]')
    const ctx = canvas.getContext('2d')
    const clear = ctx.clearRect.bind(ctx)
    let clears = 0
    ctx.clearRect = (...args) => { clears++; clear(...args) }
    for (let i = 0; i < 120; i++) next(performance.now() + i * 16)
    const blank = !ctx.getImageData(0, 0, canvas.width, canvas.height).data.some(Boolean)
    controller.dispose()
    window.requestAnimationFrame = request
    window.cancelAnimationFrame = cancel
    return { clears, blank }
  })
  expect(result.blank).toBe(true)
  expect(result.clears).toBeLessThanOrEqual(1)
})

test('a firework frame reads room and video layout only once each', async ({ page }) => {
  await page.goto(process.env.RAIN_AR_DEV_URL)
  const reads = await page.evaluate(async () => {
    window.dispatchEvent(new Event('pagehide'))
    const { mountFirework } = await import('/src/firework/controller.js')
    const request = window.requestAnimationFrame
    const cancel = window.cancelAnimationFrame
    let next
    window.requestAnimationFrame = callback => { next = callback; return 1 }
    window.cancelAnimationFrame = () => {}
    const controller = mountFirework({ snapshot: { state: 'NEUTRAL', timestamp: 0 } })
    controller.trigger({ seed: 1201, source: 'manual' })
    const room = document.querySelector('.live-room')
    const video = document.querySelector('video')
    let reads = 0
    const originals = [room, video].map(element => {
      const original = element.getBoundingClientRect
      element.getBoundingClientRect = function () { reads++; return original.call(this) }
      return original
    })
    next(performance.now() + 800)
    ;[room, video].forEach((element, i) => { element.getBoundingClientRect = originals[i] })
    controller.dispose()
    window.requestAnimationFrame = request
    window.cancelAnimationFrame = cancel
    return reads
  })
  expect(reads).toBeLessThanOrEqual(2)
})

test('fixed-seed live frames match the pre-optimization baseline at mobile and desktop sizes', async ({ browser, baseURL }) => {
  test.skip(!process.env.FIREWORK_BASELINE_URL, 'Set the baseline server URL to compare both revisions')
  const comparisons = []
  for (const viewport of [
    {width:414,height:896,dpr:1}, {width:390,height:844,dpr:3}, {width:960,height:700,dpr:2},
    {width:414,height:896,dpr:1,videoWidth:1280,videoHeight:720,fit:'cover'},
    {width:390,height:844,dpr:3,videoWidth:1280,videoHeight:720,fit:'contain'},
    {width:960,height:700,dpr:2,videoWidth:720,videoHeight:1280,fit:'cover:0.65'},
  ]) {
    const context = await browser.newContext({ viewport:{width:viewport.width,height:viewport.height}, deviceScaleFactor: viewport.dpr })
    const images = []
    for (const url of [process.env.FIREWORK_BASELINE_URL, process.env.RAIN_AR_DEV_URL || baseURL]) {
      const page = await context.newPage()
      await page.goto(url)
      images.push(await page.evaluate(async viewport => {
        window.dispatchEvent(new Event('pagehide'))
        const video = document.querySelector('video')
        if (viewport.videoWidth) {
          Object.defineProperty(video,'videoWidth',{value:viewport.videoWidth})
          Object.defineProperty(video,'videoHeight',{value:viewport.videoHeight})
          video.dataset.fit = viewport.fit
        }
        const { mountFirework } = await import('/src/firework/controller.js')
        const request = window.requestAnimationFrame
        const cancel = window.cancelAnimationFrame
        const clock = performance.now.bind(performance)
        const random = Math.random
        let next, now = 1000
        window.requestAnimationFrame = callback => { next = callback; return 1 }
        window.cancelAnimationFrame = () => {}
        performance.now = () => now
        Math.random = () => .25
        const controller = mountFirework({snapshot:{state:'NEUTRAL',timestamp:now}})
        const canvas = document.querySelector('[data-renderer="live-particles"]')
        const ctx = canvas.getContext('2d')
        controller.trigger({seed:1201,source:'manual'})
        const frames = []
        for (const elapsed of [0,80,200,400,650,1050,1500,2200,4000,6500,10000]) {
          now = 1000 + elapsed
          next(now)
          frames.push({elapsed, pixels:canvas.toDataURL(), active:canvas.dataset.activeCount,
            groups:canvas.dataset.groupCount, particles:canvas.dataset.activeParticles})
        }
        controller.dispose()
        performance.now = clock
        Math.random = random
        window.requestAnimationFrame = request
        window.cancelAnimationFrame = cancel
        return frames
      }, viewport))
      await page.close()
    }
    for (let i = 0; i < images[0].length; i++) {
      const before = images[0][i], after = images[1][i]
      expect(after, `frame ${before.elapsed} at ${viewport.width}px DPR ${viewport.dpr}`).toEqual(before)
      comparisons.push({viewport,elapsed:before.elapsed,identical:true})
    }
    await context.close()
  }
  const { writeFile } = await import('node:fs/promises')
  await writeFile('reports/performance-visual-comparison.json', JSON.stringify(comparisons, null, 2))
})

test('real face landmarks and blendshapes match on the same portrait input', async ({ browser, baseURL }) => {
  test.skip(!process.env.FIREWORK_BASELINE_URL, 'Set the baseline server URL to compare both revisions')
  const { readFile } = await import('node:fs/promises')
  const portrait = Array.from(await readFile(new URL('./fixtures/grace-hopper.gray', import.meta.url)))
  const outputs = []
  for (const url of [process.env.FIREWORK_BASELINE_URL, process.env.RAIN_AR_DEV_URL || baseURL]) {
    const page = await browser.newPage()
    // The old revision's CDN is unreachable here. Supply its exact installed
    // runtime bytes so the comparison exercises the same model in both revisions.
    await page.route('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm/**', async route => {
      const name = new URL(route.request().url()).pathname.split('/').at(-1)
      await route.fulfill({ body: await readFile(new URL(`../node_modules/@mediapipe/tasks-vision/wasm/${name}`, import.meta.url)),
        contentType: name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' })
    })
    await page.route('https://storage.googleapis.com/mediapipe-models/**', async route => {
      const name = new URL(route.request().url()).pathname.split('/').at(-1)
      await route.fulfill({body: await readFile(new URL(`../public/mediapipe/models/v1/${name}`,import.meta.url)),
        contentType:'application/octet-stream'})
    })
    await page.route('https://cdn.jsdmirror.cn/**', async route => {
      const name = new URL(route.request().url()).pathname.split('/').at(-1)
      const path = name.endsWith('.task') ? `../public/mediapipe/models/v1/${name}`
        : `../node_modules/@mediapipe/tasks-vision/wasm/${name}`
      await route.fulfill({body:await readFile(new URL(path,import.meta.url)),
        contentType:name.endsWith('.js') ? 'text/javascript' : name.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'})
    })
    await page.goto(url)
    outputs.push(await page.evaluate(async portrait => {
      const { createTracker } = await import('/src/tracker.js')
      const { ExpressionManager } = await import('/src/expression/manager.js')
      const { expressionGeometry } = await import('/src/expression/pose.js')
      const canvas = document.createElement('canvas')
      canvas.width = 320; canvas.height = 240
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#303030'; ctx.fillRect(0,0,320,240)
      const image = ctx.createImageData(150,176)
      for (let i = 0; i < portrait.length; i++) {
        image.data[i*4] = image.data[i*4+1] = image.data[i*4+2] = portrait[i]
        image.data[i*4+3] = 255
      }
      ctx.putImageData(image,85,30)
      const tracker = await createTracker()
      const expressions = new ExpressionManager()
      let result
      const states = []
      try {
        for (let time = 1000; time <= 2400; time += 100) {
          result = tracker.detectForVideo(canvas,time)
          expressions.update(result.faceBlendshapes?.[0]?.categories,Boolean(result.faceLandmarks?.length),time,expressionGeometry(result,.75))
          states.push(expressions.snapshot.state)
        }
        return { points: result.faceLandmarks[0], scores: result.faceBlendshapes[0]?.categories.map(c=>c.score), states }
      } finally { tracker.close() }
    }, portrait))
    await page.close()
  }
  expect(outputs[0].points).toHaveLength(478)
  expect(outputs[1].states).toEqual(outputs[0].states)
  expect(outputs[1].scores).toHaveLength(outputs[0].scores.length)
  for (let i = 0; i < 478; i++) for (const axis of ['x','y','z']) {
    expect(outputs[1].points[i][axis]).toBeCloseTo(outputs[0].points[i][axis],5)
  }
  outputs[0].scores.forEach((score,i)=>expect(outputs[1].scores[i]).toBeCloseTo(score,5))
})

test('rain protection preserves results and measures the same trajectory workload', async ({ browser, baseURL }, info) => {
  test.skip(!process.env.FIREWORK_BASELINE_URL, 'Set the baseline server URL to compare both revisions')
  const measurements = []
  for (const url of [process.env.FIREWORK_BASELINE_URL, process.env.RAIN_AR_DEV_URL || baseURL]) {
    const page = await browser.newPage()
    await page.goto(url)
    measurements.push(await page.evaluate(async () => {
      const { faceOpacity } = await import('/src/rain/visibility.js')
      const face = { margin:6, points:Array.from({length:36},(_,i)=>({
        x:207+55*Math.cos(i/36*Math.PI*2),y:300+90*Math.sin(i/36*Math.PI*2)})) }
      let seed = 1201
      const random = () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32)
      const paths = Array.from({length:2000},()=>{
        const from={x:random()*414,y:random()*896}
        return {from,to:{x:from.x+(random()-.5)*10,y:from.y+5+random()*10}}
      })
      const outputs=paths.map(p=>faceOpacity(face,p.from,p.to))
      const timings=[]
      for(let iteration=0;iteration<9;iteration++) {
        const start=performance.now()
        for(const path of paths) faceOpacity(face,path.from,path.to)
        timings.push(performance.now()-start)
      }
      timings.sort((a,b)=>a-b)
      return {outputs,medianMs:timings[4],trajectories:paths.length}
    }))
    await page.close()
  }
  expect(measurements[1].outputs).toEqual(measurements[0].outputs)
  const report={scope:'desktop Chrome, face-mask microbenchmark, 2000 fixed trajectories per batch',
    beforeMs:measurements[0].medianMs,afterMs:measurements[1].medianMs,
    reductionPercent:100*(1-measurements[1].medianMs/measurements[0].medianMs)}
  console.log('Face protection benchmark',JSON.stringify(report))
  await info.attach('face-protection-performance',{body:JSON.stringify(report,null,2),contentType:'application/json'})
  const {mkdir,writeFile}=await import('node:fs/promises')
  await mkdir('reports',{recursive:true})
  await writeFile('reports/face-protection-performance.json',JSON.stringify(report,null,2))
})

test('a sustained closed grin triggers live fireworks and face loss stops scheduling', async ({ page }) => {
  await page.goto(process.env.RAIN_AR_DEV_URL)
  await page.evaluate(async () => {
    const video=document.querySelector('video')
    video.srcObject=await navigator.mediaDevices.getUserMedia({video:true,audio:false})
    await video.play()
    const {expressions}=await import('/src/expression/panel.js')
    const {names}=await import('/src/expression/manager.js')
    const categories=names.map((categoryName,i)=>({categoryName,score:[.85,.85,0,0,0,.3,.3,.35,.35][i]}))
    const context={pose:{available:true,valid:true,yaw:0,pitch:0},mouthOpenness:.02,landmarkGeometryValid:true}
    const start=performance.now()
    while(performance.now()-start<650) {
      expressions.update(categories,true,performance.now(),context)
      await new Promise(resolve=>setTimeout(resolve,40))
    }
  })
  const canvas=page.locator('[data-renderer="live-particles"]')
  await expect(canvas).toHaveAttribute('data-source','laugh')
  expect(Number(await canvas.getAttribute('data-trigger-count'))).toBeGreaterThan(0)
  await page.evaluate(async()=>{
    const {expressions}=await import('/src/expression/panel.js')
    expressions.update([],false,performance.now())
    document.querySelector('video').srcObject.getTracks().forEach(track=>track.stop())
  })
  await expect(canvas).toHaveAttribute('data-pending-count','0')
})
