import { videoFit, videoGeometry } from '../projection.js'

function crownY(points, x) {
  for (let index = 1; index < points.length; index++) {
    const left = points[index - 1]
    const right = points[index]
    if (x >= left.x && x <= right.x) return left.y + (right.y - left.y) * (x - left.x) / (right.x - left.x)
  }
}

function metrics(values) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b)
  return ordered.length ? {
    samples: ordered.length, mean: ordered.reduce((sum, value) => sum + value, 0) / ordered.length,
    p95: ordered[Math.ceil(ordered.length * .95) - 1], max: ordered.at(-1),
  } : null
}

export function crownBoundaryErrors(reference, hair, crown, designScale) {
  if (!reference?.length || !hair || !crown) return undefined
  const compare = boundary => {
    let worst
    const errors = [...boundary.values].map((y, index) => {
      const x = boundary.x + (index + .5) * boundary.step
      const referenceY = crownY(reference, x)
      const error = Math.abs(y - referenceY) * designScale
      if (Number.isFinite(error) && (!worst || error > worst.error)) {
        worst = { x: x * designScale, y: y * designScale, referenceY: referenceY * designScale, error }
      }
      return error
    })
    const summary = metrics(errors)
    return summary && { ...summary, worst }
  }
  return { rawHair: compare(hair), collisionCrown: compare(crown) }
}

export function createCrownTest(video, canvas, readState) {
  const button = document.querySelector('#crown-test-start')
  const exportButton = document.querySelector('#crown-test-export')
  const review = document.querySelector('#crown-test-review')
  const status = document.querySelector('#crown-test-status')
  const scenario = document.querySelector('#crown-test-scenario')
  const source = document.createElement('canvas')
  let session
  let deadline
  let releaseAt
  let snapshotAt
  let timer
  let capturePending
  let manualCapturePending

  function report() {
    const events = [...session.events.values()]
    const eligible = events.filter(event => event.confirmed && event.result !== 'pending')
    const hits = eligible.filter(event => event.result === 'hit').length
    const premature = events.filter(event => event.result === 'premature-response').length
    const classified = { onTime: hits, late: 0, missed: 0, noSurface: 0, nonContact: 0 }
    for (const event of events) {
      if (event.result === 'hit') continue
      if (event.result === 'late-response') classified.late++
      else if (event.confirmed && !event.active) classified.noSurface++
      else if (event.confirmed && event.result !== 'pending') classified.missed++
      else classified.nonContact++
    }
    return {
      scenario: session.scenario, reference: session.reference, durationMs: Math.min(performance.now(), deadline) - session.start,
      classified, observedTracks: events.length, premature,
      prematureRate: eligible.length + premature ? premature / (eligible.length + premature) : null,
      impactError414: metrics(events.filter(event => event.response).map(event => Math.abs(event.impactError414))),
      responseDelayMs: metrics(events.filter(event => event.response).map(event => event.delayMs)),
      eligible: eligible.length, hits, rate: eligible.length ? hits / eligible.length : null,
      pending: events.filter(event => event.result === 'pending').length,
      suspectedPassThrough: eligible.filter(event => event.result === 'pass-through').length,
      lateResponses: eligible.filter(event => event.result === 'late-response').length,
      unconfirmedResponses: events.filter(event => !event.confirmed && event.response).length,
      frames: session.frames, events, anomalyFrames: session.anomalyFrames,
    }
  }

  function capture(event) {
    if (!video.videoWidth) return
    const kind = event?.result ?? 'manual-review'
    if (session.anomalyFrames.length >= 8) {
      if (session.anomalyFrames.some(frame => frame.kind === kind)) return
      const index = session.anomalyFrames.findIndex(frame =>
        session.anomalyFrames.filter(other => other.kind === frame.kind).length > 1)
      if (index < 0) return
      session.anomalyFrames.splice(index, 1)
    }
    source.width = Math.min(video.videoWidth, 480)
    source.height = Math.round(source.width * video.videoHeight / video.videoWidth)
    const image = source.getContext('2d')
    image.drawImage(video, 0, 0, source.width, source.height)
    const sourceImage = source.toDataURL('image/jpeg', .76)
    source.width = Math.round(video.clientWidth)
    source.height = Math.round(video.clientHeight)
    const geo = videoGeometry(source.width, source.height, video.videoWidth, video.videoHeight, videoFit(video))
    image.translate(source.width, 0)
    image.scale(-1, 1)
    image.drawImage(video, source.width - geo.x - geo.imageWidth, geo.y, geo.imageWidth, geo.imageHeight)
    image.resetTransform()
    image.drawImage(canvas, 0, 0, source.width, source.height)
    session.anomalyFrames.push({
      id: event?.id, kind, time: performance.now(), mediaTime: video.currentTime, state: readState(),
      sourceImage, compositeImage: source.toDataURL('image/jpeg', .8), overlayImage: canvas.toDataURL('image/png'),
    })
  }

  function finish() {
    if (!timer) return
    clearTimeout(timer)
    timer = undefined
    const result = report()
    if (session.scenario === 'clipped' && !session.anomalyFrames.length) capture()
    button.textContent = '开始 20 秒测试'
    exportButton.disabled = false
    review.disabled = true
    scenario.disabled = false
    const estimate = session.reference === 'fixture-annotation' ? '标注参考' : '分割参考，需目视复核'
    status.textContent = `完成 · ${estimate} · 有效 ${result.eligible} · 命中 ${result.hits} · 疑似穿透 ${result.suspectedPassThrough} · ${result.rate === null ? '命中率不可计算' : (100 * result.rate).toFixed(1) + '%'}`
    window.__crownTestDone?.(report())
  }

  button.onclick = () => {
    if (timer) return finish()
    if (!video.srcObject || video.paused || !document.querySelector('#surface-enabled').checked) {
      status.textContent = '请先开启摄像头及阶段 1.5 人体水珠测试'
      return
    }
    const start = performance.now()
    capturePending = undefined
    manualCapturePending = false
    session = {
      start, scenario: scenario.value, events: new Map(), frames: [], anomalyFrames: [],
      reference: window.__crownReference ? 'fixture-annotation' : 'segmentation-proxy',
    }
    deadline = start + 20_000
    releaseAt = start
    snapshotAt = start
    exportButton.disabled = true
    button.textContent = '停止测试'
    scenario.disabled = true
    review.disabled = false
    status.textContent = '正在记录 · 人体分割参考须人工复核'
    const debug = document.querySelector('#head-collision-debug')
    debug.checked = true
    debug.onchange()
    timer = setTimeout(finish, 20_000)
  }

  review.onclick = () => { if (timer) manualCapturePending = true }

  exportButton.onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report(), null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `crown-${session.scenario}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return {
    tick(now, allowRelease, hair, crown) {
      if (!timer) return false
      if (now >= snapshotAt) {
        const reference = window.__crownReference?.(video)
        const boundaryError414 = crownBoundaryErrors(reference, hair, crown, 896 / video.clientHeight)
        session.frames.push({ time: now, ...readState(), boundaryError414,
          collisionBoundary: crown && { x: crown.x, step: crown.step, values: [...crown.values] },
          hairBoundary: hair && { x: hair.x, step: hair.step, values: [...hair.values] },
        })
        snapshotAt = now + 250
      }
      if (!allowRelease || now < releaseAt || now > deadline - 2200) return false
      releaseAt = now + 41
      return true
    },
    get active() { return Boolean(timer) },
    inspect({ id, from, to, check, impact, velocity }, head, hairBoundary, now) {
      let event = session.events.get(id)
      const reference = window.__crownReference?.(video)
      const x = to.x
      const y = reference ? crownY(reference, x) : hairBoundary?.values[Math.floor((x - hairBoundary.x) / hairBoundary.step)]
      const contact = impact?.patch === 'head'
      const tolerance = Math.max(3, video.clientHeight * .012)
      const crosses = Number.isFinite(y) && from.y <= y && to.y >= y
      const contactAtReference = contact && Number.isFinite(y) && Math.abs(impact.position.y - y) <= tolerance
      const nearReference = Number.isFinite(y) && to.y >= y - 55 && from.y <= y + tolerance
      if (!event && !nearReference && !contact && !check) return
      if (!event) {
        event = { id, entryTime: now, position: from, velocity: { ...velocity }, ...readState(), referenceY: y,
          confirmed: false, candidate: false, intersected: false, response: false, rejectedByMask: false, result: 'pending', path: [] }
        session.events.set(id, event)
      }
      if (event.result !== 'pending') return
      event.path.push({ from, to })
      if (event.path.length > 48) event.path.shift()
      if (crosses && !event.referenceTouch) {
        const progress = (y - from.y) / (to.y - from.y || 1)
        const touchX = from.x + (to.x - from.x) * progress
        const geometry = videoGeometry(video.clientWidth, video.clientHeight, video.videoWidth, video.videoHeight, videoFit(video))
        event.referenceTouch = {
          time: now - (1 - progress) * 1000 / 120,
          design: { x: touchX * 414 / video.clientWidth, y: y * 896 / video.clientHeight },
          source: { x: (1 - (touchX - geometry.x) / geometry.imageWidth) * video.videoWidth,
            y: (y - geometry.y) / geometry.imageHeight * video.videoHeight },
        }
      }
      event.confirmed ||= crosses || contactAtReference
      event.candidate ||= Boolean(check || contact || (head && Number.isFinite(head.crown.values[
        Math.floor((x - head.crown.x) / head.crown.step)])))
      if (hairBoundary) {
        event.hairColumnY = hairBoundary.values[Math.floor((x - hairBoundary.x) / hairBoundary.step)]
      }
      event.colliderColumnY = head?.crown.values[Math.floor((x - head.crown.x) / head.crown.step)]
      event.intersected ||= Boolean(check?.allowed || contact)
      event.rejectedByMask ||= check?.result === 'mask'
      if (impact) {
        event.response = contact
        event.splashEmitted = impact.splashEmitted
        event.impact = impact
        event.offsetFromReferencePx = Number.isFinite(y) ? impact.position.y - y : undefined
        event.impactError414 = event.offsetFromReferencePx * 896 / video.clientHeight
        if (event.referenceTouch) event.delayMs = Math.max(0, now - event.referenceTouch.time)
        event.reason = !contact ? 'other-surface-first' : !impact.splashEmitted ? 'collision-without-splash-emission'
          : !contactAtReference ? 'response-outside-reference' : undefined
        event.result = !contact ? 'other-surface' : !impact.splashEmitted ? 'response-without-splash'
          : contactAtReference ? 'hit' : Number.isFinite(y) && event.offsetFromReferencePx < -tolerance
            ? 'premature-response' : event.confirmed && event.offsetFromReferencePx > tolerance
            ? 'late-response' : 'response-outside-reference'
        if (event.result === 'late-response') event.reason = 'response-below-visible-reference'
      // Keep tracking beyond the optical edge so late deflection is distinct
      // from a drop that continues through the upper head without a response.
      } else if (event.confirmed && Number.isFinite(event.referenceY)
        && to.y > Math.max(event.referenceY + tolerance * 2, head?.center.y ?? event.referenceY + video.clientHeight * .12)) {
        event.result = 'pass-through'
        event.passedVisibleReference = true
        event.reason = !head ? 'inactive-collider' : event.rejectedByMask ? 'mask-rejected'
          : event.intersected ? 'intersection-without-response' : !event.candidate ? 'outside-crown-candidate'
            : 'no-surface-intersection-at-reference'
      }
      if (event.result !== 'pending') {
        event.end = impact?.position ?? to
        event.resolvedTime = now
        event.resolutionState = readState()
        if (event.result === 'pass-through' || event.result === 'response-without-splash' || event.result === 'response-outside-reference' || event.result === 'late-response' || event.result === 'premature-response') {
          capturePending ??= event
        }
      }
    },
    paint(ctx) {
      if (!session) return
      const reference = window.__crownReference?.(video)
      if (reference?.length) {
        ctx.strokeStyle = '#ffffff'
        ctx.beginPath()
        reference.forEach(({ x, y }, index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
        ctx.stroke()
      }
      const events = [...session.events.values()].filter(event => event.confirmed || event.result === 'premature-response').slice(-20)
      for (const event of events) {
        ctx.strokeStyle = event.result === 'hit' ? '#60ff96' : event.result === 'pass-through' ? '#ff5364' : event.result === 'late-response' ? '#ff9b41' : event.result === 'premature-response' ? '#f386ff' : '#ffffff88'
        ctx.fillStyle = ctx.strokeStyle
        ctx.beginPath()
        for (const { from, to } of event.path) {
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(to.x, to.y)
        }
        ctx.stroke()
        if (event.end) ctx.fillRect(event.end.x - 2, event.end.y - 2, 4, 4)
      }
    },
    captureFrame() {
      if (capturePending) capture(capturePending)
      if (manualCapturePending) capture()
      capturePending = undefined
      manualCapturePending = false
    },
    finish,
  }
}
