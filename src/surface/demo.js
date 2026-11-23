import { createCrownTest } from './crown-test.js'
import { projectPoints, videoFit, videoGeometry } from '../projection.js'
import { createEffectMeasurement, facePolygon, facePath, insideFace } from './quality.js'
import { buildSurface, maskAt, maskCategoryAt } from './model.js'
import { normal, stepDrops, world } from './physics.js'

export function createSurfaceDemo(video, framing) {
  const enabled = document.querySelector('#surface-enabled')
  const debug = document.querySelector('#surface-debug')
  const headDebug = document.querySelector('#head-collision-debug')
  const headStats = document.querySelector('#head-collision-stats')
  const headChecks = new Map()
  const hairEntries = new Map()
  let headState = { active: false, reason: '等待人体追踪' }
  headDebug.onchange = () => {
    headStats.hidden = !headDebug.checked
    headChecks.clear()
    hairEntries.clear()
    headStats.textContent = '等待人体追踪'
  }
  const output = document.querySelector('#surface-status')
  const canvas = document.querySelector('#surface-canvas')
  const ctx = canvas.getContext('2d')
  const room = video.closest('.live-room')
  const outside = document.querySelector('#surface-outside-stage')
  const outsideContext = outside.getContext('2d')
  let roomWidth = 0
  let roomHeight = 0
  let stageTop = 0
  let pendingDrops = []
  function paintDrop(context, drop, yOffset = 0) {
    context.beginPath()
    context.arc(drop.position.x, drop.position.y + yOffset, drop.radius, 0, Math.PI * 2)
    context.fillStyle = '#3ea6ff'
    context.globalAlpha = drop.fade ? Math.max(0, Math.min(1, drop.life / drop.fade)) : 1
    context.fill()
    context.globalAlpha = 1
  }
  const spawn = document.querySelector('#surface-spawn')
  let interactive = false
  let failed = false
  let admitted = false
  let fit
  const maskDebug = document.querySelector('#face-mask-debug')
  const alphaView = document.querySelector('#face-alpha-view')
  const maskStats = document.querySelector('#face-mask-stats')
  let facePoints
  let protection
  let measurement
  let worker
  let preparation
  let resolvePreparation
  let rejectPreparation
  let generation = 0
  let busy = false
  let latest
  let patches = []
  let drops = []
  let lastFrame = 0
  let lastSent = -Infinity
  let lastAccepted = 0
  let staleFrames = 0
  let accumulator = 0
  let width = 0
  let height = 0
  let serial = 0
  const crownTest = createCrownTest(video, canvas, () => ({
    active: headState.active, inactiveReason: headState.reason, framing: framing.state,
    bounds: headState.bounds && { ...headState.bounds }, mask: headState.sourceMask, viewport: { width, height, fit },
    source: { width: video.videoWidth, height: video.videoHeight },
    colliderUpdatedAt: latest ? lastAccepted : undefined, segmentationSubmittedAt: latest?.time, segmentationFinishedAt: latest && latest.inferenceFinishedAt - performance.timeOrigin,
    staleFrames, frameAgeMs: latest && performance.now() - latest.time,
    videoTime: video.currentTime, maskVideoTime: latest?.videoTime,
  }))
  const counts = { attached: 0, detached: 0, splashes: 0 }

  function clearSurface(reason = '等待人体追踪') {
    headState = { active: false, reason }
    if (headDebug.checked) headStats.textContent = `Inactive · ${reason} · 构图 ${framing.state}`
    protection = undefined
    facePoints = undefined
    maskStats.textContent = ''
    latest = undefined
    patches = []
    drops = []
    pendingDrops = []
    outsideContext.clearRect(0, 0, roomWidth, roomHeight)
    spawn.disabled = true
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
  function stop() {
    crownTest.finish()
    admitted = false
    failed = false
    generation++
    rejectPreparation?.(new Error('人体模型加载已取消'))
    preparation = resolvePreparation = rejectPreparation = undefined
    worker?.terminate()
    worker = undefined
    busy = false
    lastFrame = 0
    lastSent = -Infinity
    staleFrames = 0
    clearSurface()
    output.textContent = '人体表面测试已停止'
  }
  function start(preload = false) {
    if (failed || worker || (!preload && !video.srcObject)) return
    output.textContent = '加载人体姿态与分割模型…'
    worker = import.meta.env.DEV
      ? new Worker('/surface-worker.js')
      : new Worker(new URL('./perception.worker.js', import.meta.url))
    worker.onmessage = ({ data }) => {
      busy = false
      if (data.error) {
        rejectPreparation?.(new Error(data.error))
        stop()
        failed = true
        output.textContent = '人体模型失败，请关闭再开启测试。' + data.error
        return
      }
      if (data.type === 'ready') {
        resolvePreparation?.()
        resolvePreparation = rejectPreparation = undefined
        return
      }
      // Worker output is in source coordinates, so a crop pan does not stale the frame.
      if (data.videoWidth !== video.videoWidth || data.videoHeight !== video.videoHeight) return
      // The first frame may have waited for model downloads. Its arrival time does not
      // make its segmentation current enough to apply to the camera preview.
      if (performance.now() - data.time > 750) {
        staleFrames++
        return
      }
      data.mode = fit
      framing.accept(data, width, height)
      if ((!enabled.checked && !interactive) || framing.reframing) return
      const previous = latest ? { time: latest.time, patches } : undefined
      headState = {}
      patches = buildSurface(data, width, height, previous, headState)
      admitted ||= framing.ready || headState.active
      latest = data
      lastAccepted = performance.now()
      if (!patches.length) {
        const diagnosis = headState
        if (!interactive) clearSurface(headState.reason)
        headState = diagnosis
        output.textContent = '请让头部、双肩和上半身进入画面'
      } else {
        spawn.disabled = !admitted
        output.textContent = `人体追踪中 · ${patches.length} 个曲面 · 深度为近似值`
      }
      window.__surfaceDiagnostics?.({ patches: patches.length, maskPixels: data.mask.filter(x => x >= 1 && x <= 4).length,
        posePoints: data.pose?.length ?? 0, time: data.time })
    }
    worker.onerror = event => {
      rejectPreparation?.(new Error(event.message))
      stop()
      failed = true
      output.textContent = '人体处理线程失败，请关闭再开启测试。' + event.message
    }
  }
  enabled.onchange = () => {
    failed = false
    canvas.hidden = !enabled.checked
    if (enabled.checked) start()
    else { admitted = false; if (!interactive) clearSurface(); else { drops = []; pendingDrops = []; ctx.clearRect(0, 0, width, height); outsideContext.clearRect(0, 0, roomWidth, roomHeight) } }
  }

  spawn.onclick = () => {
    if (!admitted || spawn.disabled) return
    const start = performance.now()
    for (let index = 0; index < 24; index++) {
      pendingDrops.push(start + index * 42 + Math.random() * 30)
    }
    pendingDrops.sort((a, b) => a - b)
    pendingDrops = pendingDrops.slice(0, 60)
  }

  function paintBoundary(boundary, color) {
    ctx.strokeStyle = color
    ctx.beginPath()
    boundary.values.forEach((y, index) => {
      if (!Number.isFinite(y)) return
      const left = boundary.x + index * boundary.step
      ctx.moveTo(left, y)
      ctx.lineTo(left + boundary.step, y)
    })
    ctx.stroke()
  }

  function draw(now) {
    if (!enabled.checked) return
    if (framing.reframing) {
      clearSurface()
      return
    }
    admitted ||= framing.ready
    spawn.disabled = !admitted || !patches.length
    if (video.paused) {
      lastFrame = now
      clearSurface()
      return
    }
    if (latest && now - lastAccepted > 750) {
      clearSurface('人体追踪超时')
      output.textContent = '人体追踪暂时中断'
    }
    const delta = lastFrame ? Math.min((now - lastFrame) / 1000, .1) : 0
    lastFrame = now
    ctx.clearRect(0, 0, width, height)
    outsideContext.clearRect(0, 0, roomWidth, roomHeight)
    if (headDebug.checked && !alphaView.checked && headState.hairBoundary) {
      ctx.save()
      ctx.lineWidth = 1
      paintBoundary(headState.hairBoundary, '#ffe075')
      ctx.restore()
    }
    if (crownTest.tick(now, Boolean(latest && patches.length), headState.hairBoundary, headState.crown)) pendingDrops.unshift(now)
    if (!latest || !patches.length) return
    while (pendingDrops.length && pendingDrops[0] <= now) {
      pendingDrops.shift()
      const x = Math.random() * roomWidth
      const headTarget = patches.find(patch => patch.crown && Number.isFinite(
        patch.crown.values[Math.floor((x - patch.crown.x) / patch.crown.step)]))
      const target = headTarget ?? patches.reduce((nearest, patch) =>
        Math.abs(patch.center.x - x) < Math.abs(nearest.center.x - x) ? patch : nearest)
      const drop = {
        id: serial++, position: { x, y: -stageTop - 4, z: target.center.z - target.radius.z * .45 },
        velocity: { x: 0, y: 30 + Math.random() * 65, z: 0 },
        radius: 2 + Math.random() * 1.5, state: 'free', life: 10,
      }
      drops.push(drop)
      window.__surfaceSpawn?.({ x, y: drop.position.y + stageTop, width: roomWidth, stageTop, time: now })
    }
    drops = drops.slice(-80)
    accumulator = Math.min(accumulator + delta, .1)
    const protectedFace = protection && now - protection.time <= 160 ? protection : null
    const path = protectedFace ? facePath(protectedFace.points) : null
    const valid = p => maskAt(latest, width, height, p)
    const head = headDebug.checked && patches.find(patch => patch.id === 'head')
    const inspectHead = head || crownTest.active ? (id, from, to, check, contacted, velocity, impact) => {
      if (crownTest.active) crownTest.inspect({ id, from, to, check, impact, velocity }, head, headState.hairBoundary, now)
      if (!head) return
      if (check && headChecks.get(id)?.result !== 'hit') {
        if (headChecks.size >= 256 && !headChecks.has(id)) headChecks.delete(headChecks.keys().next().value)
        headChecks.set(id, check)
      }
      if (contacted === 'head') {
        hairEntries.set(id, 'hit')
      } else if (from.y < head.center.y && to.y >= headState.bounds.top && to.x >= headState.bounds.left
        && to.x <= headState.bounds.right && !hairEntries.has(id)) {
        for (let y = Math.max(from.y, headState.bounds.top); y <= Math.min(to.y, head.center.y); y += 1) {
          const label = maskCategoryAt(latest, width, height, { x: to.x, y })
          if (label === 1 || label === 3) {
            hairEntries.set(id, 'pending')
            break
          }
        }
      }
      if (hairEntries.get(id) === 'pending') {
        if (contacted) hairEntries.set(id, 'other-surface')
        else if (to.y >= head.center.y) hairEntries.set(id, 'miss')
      }
      if (hairEntries.size > 256) hairEntries.delete(hairEntries.keys().next().value)
    } : undefined
    while (accumulator >= 1 / 120) {
      const states = new Map(drops.map(d => [d.id, d.state]))
      const newDrops = stepDrops(drops, patches, 1 / 120, valid, window.__surfaceCollision, protectedFace
        ? point => insideFace(protectedFace.points, point) ? Math.sign(point.x - protectedFace.center) || 1 : 0
        : undefined, inspectHead)
      for (const drop of newDrops) {
        if (drop.id === undefined) { drop.id = serial++; counts.splashes++ }
        if (states.get(drop.id) === 'free' && drop.state === 'attached') counts.attached++
        if (states.get(drop.id) === 'attached' && drop.state === 'free') counts.detached++
      }
      drops = newDrops.filter(d => d.position.y < roomHeight - stageTop + 50 && d.position.x > -100 && d.position.x < width + 100)
      accumulator -= 1 / 120
    }

    if (debug.checked) {
      ctx.fillStyle = '#7bffbb'
      const step = 5
      for (let y = step; y < height - step; y += step) {
        for (let x = step; x < width - step; x += step) {
          if (valid({ x, y }) && (!valid({ x: x - step, y }) || !valid({ x: x + step, y })
            || !valid({ x, y: y - step }) || !valid({ x, y: y + step }))) ctx.fillRect(x, y, 2, 2)
        }
      }
      for (const patch of patches) {
        ctx.strokeStyle = '#ffd166'
        ctx.beginPath()
        for (let i = 0; i <= 48; i++) {
          const theta = i / 48 * Math.PI * 2
          const p = world(patch, { x: Math.cos(theta), y: Math.sin(theta), z: 0 })
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
        for (let i = 0; i < 12; i++) {
          const theta = i / 12 * Math.PI * 2
          const uv = { x: .8 * Math.cos(theta), y: .8 * Math.sin(theta), z: -.6 }
          const p = world(patch, uv)
          const n = normal(patch, uv)
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x + n.x * 18, p.y + n.y * 18)
          ctx.strokeStyle = '#d7afff'
          ctx.stroke()
        }
      }
    }
    if (headDebug.checked && !alphaView.checked) {
      if (head) {
        // Draw the actual ellipsoid at the same depth as a newly emitted head drop.
        const z = -.45
        const radius = Math.sqrt(1 - z * z)
        ctx.save()
        ctx.strokeStyle = '#ff80ef'
        ctx.lineWidth = 2
        ctx.beginPath()
        let visible = false
        for (let index = 0; index <= 360; index++) {
          const angle = index * Math.PI / 180
          const point = world(head, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z })
          const allowed = valid(point)
          if (allowed && visible) ctx.lineTo(point.x, point.y)
          else if (allowed) ctx.moveTo(point.x, point.y)
          visible = allowed
        }
        ctx.stroke()
        paintBoundary(head.crown, '#36edff')
        for (const check of [...headChecks.values()].slice(-8)) {
          ctx.fillStyle = check.result === 'hit' ? '#7bffbb' : '#ff765f'
          ctx.fillRect(check.position.x - 2, check.position.y - 2, 4, 4)
        }
        ctx.restore()
      }
      const bound = headState.bounds
      const checks = [...headChecks.values()]
      const entries = [...hairEntries.values()]
      const count = result => checks.filter(check => check.result === result).length
      headStats.textContent = [
        head ? 'Active · 头顶分割有效' : `Inactive · ${headState.reason}`,
        `构图 ${framing.state}`,
        bound && `分割 X ${Math.round(bound.left)}–${Math.round(bound.right)} / Y ${Math.round(bound.top)}–${Math.round(bound.bottom)} CSS px`,
        head && `碰撞中心 (${head.center.x.toFixed(1)}, ${head.center.y.toFixed(1)}) CSS px · 黄线：头发分类上缘 · 紫线：椭球截面 · 蓝线：补充碰撞边界`,
        `头顶轨迹 ${entries.length} · 头部命中 ${entries.filter(result => result === 'hit').length} · 疑似穿透 ${entries.filter(result => result === 'miss').length} · 待判定 ${entries.filter(result => result === 'pending').length}`,
        `几何候选 ${checks.length} · 命中 ${count('hit')} · 分割拒绝 ${count('mask')} · 先碰其他曲面 ${count('other-surface')}`,
        `扫掠起点已在碰撞体内 ${checks.filter(check => check.startedInside).length}`,
      ].filter(Boolean).join(' · ')
    }
    if (!alphaView.checked) crownTest.paint(ctx)
    const quality = window.__surfaceQuality
    measurement ??= createEffectMeasurement()
    measurement.begin(canvas, width, height)
    const effect = measurement.context
    for (const drop of drops) paintDrop(effect, drop)
    if (stageTop > 0 && !alphaView.checked) {
      outsideContext.save()
      outsideContext.beginPath()
      outsideContext.rect(0, 0, roomWidth, stageTop)
      outsideContext.rect(0, stageTop + height, roomWidth, roomHeight - stageTop - height)
      outsideContext.clip()
      for (const drop of drops) paintDrop(outsideContext, drop, stageTop)
      outsideContext.restore()
    }
    measurement.protect(path, protectedFace?.margin, width, height)
    if (alphaView.checked) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
    }
    measurement.composite(ctx, width, height)
    if (maskDebug.checked && !alphaView.checked && path) {
      ctx.save()
      ctx.strokeStyle = '#ffbd58'
      ctx.lineWidth = 2
      ctx.stroke(path)
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#ffffff'
      for (const margin of [protectedFace.margin, protectedFace.margin + 5]) {
        ctx.lineWidth = 1
        for (const offset of [-margin, margin]) {
          ctx.save()
          ctx.translate(offset, 0)
          ctx.stroke(path)
          ctx.restore()
        }
      }
      ctx.setLineDash([])
      for (const drop of drops) {
        const p = drop.position
        ctx.strokeStyle = insideFace(protectedFace.points, p) ? '#ff8a82' : '#8cdfff'
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x + drop.velocity.x * .06, p.y + drop.velocity.y * .06)
        ctx.stroke()
      }
      ctx.restore()
    }
    crownTest.captureFrame()
    if (quality || maskDebug.checked) {
      const coverage = measurement.measure(facePoints, video, width, height)
      if (maskDebug.checked) maskStats.textContent = coverage
        ? `面部覆盖 ${coverage.percent.toFixed(2)}% · 核心 Alpha 峰值 ${coverage.maxAlpha} · 安全边距 ${protectedFace?.margin.toFixed(1) ?? '—'} px`
        : '等待面部定位'
      quality?.({ time: now, videoTime: video.currentTime, drops: drops.length,
        coverage, protectionMask: protectedFace?.points ?? null })
    }
    output.textContent = `人体追踪中 · 曲面 ${patches.length} · 水珠 ${drops.length} · 附着 ${drops.filter(d => d.state === 'attached').length} · 累计接触 ${counts.attached} / 脱离 ${counts.detached} / 飞溅 ${counts.splashes} · 深度估计`
    window.__surfacePhysics?.({ ...counts, attachedNow: drops.filter(d => d.state === 'attached').length, drops: drops.length })
  }

  return {
    setInteractive(value) {
      interactive = value
      if (value && failed) failed = false
    },
    interactionFrame(now) {
      const ready = !framing.reframing && !video.paused && latest && now - latest.time <= 750
      const pose = ready && latest.pose
      let poseDepth
      if (pose?.[16] && now - latest.time < 500) {
        const joints = [11, 12, 15, 16].map(i => pose[i])
        const [left, right, leftWrist, rightWrist] = projectPoints(joints, width, height,
          latest.videoWidth, latest.videoHeight, fit).map((point, i) => ({
            ...point, z: joints[i].z, visibility: joints[i].visibility,
          }))
        poseDepth = { time: latest.time, shoulders: { 'left-shoulder': left, 'right-shoulder': right }, wrists: [leftWrist, rightWrist] }
      }
      let faceCoverage = 0
      if (ready && latest.mask?.length && now - latest.time <= 500) {
        let count = 0
        for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
          if (maskCategoryAt(latest, width, height, {x:(x+.5)*width/12,y:(y+.5)*height/12}) === 3) count++
        }
        faceCoverage = count / 144
      }
      return {
        faceCoverage,
        width: roomWidth, height: roomHeight, stageTop, stageHeight: height,
        key: `${width}:${height}:${stageTop}:${fit}`,
        cameraActive: Boolean(video.srcObject),
        patches: ready ? patches : [],
        hairBoundary: ready ? headState.visibleHairBoundary : null,
        poseDepth,
        personMask: ready && latest.mask?.length && now - latest.time <= 500 ? latest : null,
        headBounds: ready ? headState.bounds : null,
        valid: ready ? point => maskAt(latest, width, height, point) : () => false,
        face: !video.paused && protection && now - protection.time <= 160 ? protection : null,
      }
    },
    prepare() {
      if (preparation) return preparation
      failed = false
      preparation = new Promise((resolve, reject) => {
        resolvePreparation = resolve
        rejectPreparation = reject
      })
      const pending = preparation
      try {
        start(true)
        worker.postMessage({ type: 'prepare' })
      } catch (error) {
        rejectPreparation(error)
        stop()
      }
      return pending
    },
    get active() { return enabled.checked },
    update(points) {
      facePoints = points
      if (failed || !video.srcObject || video.paused) return
      start()
      const rect = video.getBoundingClientRect()
      const roomRect = room.getBoundingClientRect()
      stageTop = rect.top - roomRect.top
      if (roomWidth !== roomRect.width || roomHeight !== roomRect.height) {
        roomWidth = roomRect.width
        roomHeight = roomRect.height
        const ratio = window.devicePixelRatio || 1
        outside.width = Math.round(roomWidth * ratio)
        outside.height = Math.round(roomHeight * ratio)
        outsideContext.setTransform(ratio, 0, 0, ratio, 0, 0)
      }
      const nextFit = videoFit(video)
      if (width !== rect.width || height !== rect.height || fit?.split(':')[0] !== nextFit.split(':')[0]) {
        fit = nextFit
        admitted = false
        width = rect.width
        height = rect.height
        clearSurface()
        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      }
      if (fit !== nextFit) {
        const offset = mode => videoGeometry(width, height, video.videoWidth, video.videoHeight, mode).x
        const shift = offset(nextFit) - offset(fit)
        const centers = new Set(patches.flatMap(p => [p.center, p.previous?.center]).filter(Boolean))
        if (headState.crown) headState.crown.x += shift
        if (headState.hairBoundary) headState.hairBoundary.x += shift
        if (headState.visibleHairBoundary) headState.visibleHairBoundary.x += shift
        if (headState.bounds) {
          headState.bounds.left += shift
          headState.bounds.right += shift
        }
        for (const center of centers) center.x += shift
        for (const drop of drops) drop.position.x += shift
        if (protection) {
          protection.center += shift
          for (const point of protection.points) point.x += shift
        }
        fit = nextFit
        if (latest) latest.mode = fit
      }
      const now = performance.now()
      if (points) {
        facePoints = points
        const polygon = facePolygon(points, video, width, height)
        const min = Math.min(...polygon.map(p => p.x))
        const max = Math.max(...polygon.map(p => p.x))
        const center = (min + max) / 2
        const elapsed = protection ? now - protection.time : 0
        const travel = protection && elapsed > 0 ? Math.abs(center - protection.center) * 32 / elapsed : 0
        protection = { points: polygon, center, time: now, margin: Math.max(3, (max - min) * .025) + Math.min(14, travel) }
      }
      if (busy || !worker || now - lastSent < 100) return
      busy = true
      lastSent = now
      const token = generation
      const mode = fit
      const videoTime = video.currentTime
      const chin = points?.[152]
      const faceAnchor = points && { nose: points[1], eyes: [points[33], points[263]] }
      createImageBitmap(video).then(bitmap => {
        if (!worker || token !== generation) { bitmap.close(); return }
        worker.postMessage({ bitmap, time: now, mode, chin, faceAnchor, videoTime, videoWidth: video.videoWidth, videoHeight: video.videoHeight }, [bitmap])
      }).catch(error => {
        if (token !== generation) return
        busy = false
        clearSurface(headState.reason)
        output.textContent = '读取摄像头画面失败 · ' + error.message
      })
    },
    render: draw,
    reset: stop,
  }
}
