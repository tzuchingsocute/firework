import { videoFit } from '../projection.js'
import { handGeometry } from './model.js'
import { world } from '../surface/physics.js'

export function createHandTracking(video) {
  const panel = document.querySelector('#hand-interaction')
  const enabled = panel.querySelector('[data-hand-enabled]')
  const handState = panel.querySelector('[data-hand-state]')
  const syncEnabled = interactive => {
    const label = !enabled.checked ? '已停用' : interactive ? '已启用' : '已启用（等待 AR 互动）'
    if (handState.textContent !== label) handState.textContent = label
  }
  const status = panel.querySelector('output')
  const debug = Object.fromEntries([...panel.querySelectorAll('[data-hand-debug]')].map(
    input => [input.dataset.handDebug, input]))
  let worker
  let busy = false
  let failed
  let geometry
  let key
  let lastFrame = -1
  let lastRequest = -Infinity
  let inferenceMs = 0
  let measured = false
  let staleResults = 0
  const maxAge = 350
  let lastStatus = -Infinity
  let impactCount = 0
  let palmCount = 0
  const log = []
  const candidates = []
  const diagnostics = panel.querySelector('[data-occlusion-status]')
  function candidate(event) {
    const previous = candidates.findLastIndex(item => item.id === event.id)
    if (previous >= 0) candidates.splice(previous, 1)
    candidates.push({ ...event, timeMs: Math.round(performance.now()) })
    if (candidates.length > 120) candidates.shift()
  }
  const logOutput = panel.querySelector('[data-impact-log]')

  function impact(hit) {
    const { surface, id, x, y } = hit
    const type = surface.endsWith('-palm') ? 'PALM'
      : surface.startsWith('hand-') ? 'FINGER'
      : surface === 'head' ? 'HEAD' : surface.includes('shoulder') ? 'SHOULDER' : 'TORSO'
    if (type === 'PALM') palmCount++
    if (type === 'PALM' || type === 'FINGER') impactCount++
    if (!enabled.checked || surface === 'hair' || surface === 'face') return
    log.push({ timeMs: Math.round(performance.now()), id, type, surface, x, y, space: 'video-element-css-px' })
    if (log.length > 300) log.shift()
  }

  panel.querySelector('[data-export-impacts]').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(debug.occlusion.checked ? { impacts: log, candidates } : log, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'rain-impacts.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function reset() {
    worker?.terminate()
    worker = undefined
    busy = false
    geometry = undefined
    lastFrame = -1
    lastRequest = -Infinity
    inferenceMs = 0
    measured = false
    staleResults = 0
    impactCount = 0
    palmCount = 0
  }

  enabled.onchange = () => {
    reset()
    failed = undefined
    syncEnabled(document.querySelector('[data-rain-mode]').value === 'interactive')
    status.textContent = enabled.checked ? '等待开启 AR 互动与摄像头' : '手部互动已关闭'
  }

  function current(now, scene, interactive) {
    syncEnabled(interactive)
    if (!enabled.checked || !interactive || !video.srcObject || video.paused || !scene.stageHeight || !scene.width) {
      if (worker) reset()
      if (enabled.checked) status.textContent = '等待开启 AR 互动与摄像头'
      return []
    }
    const viewport = { width: scene.width, height: scene.stageHeight, videoWidth: video.videoWidth,
      videoHeight: video.videoHeight, fit: videoFit(video) }
    const nextKey = JSON.stringify(viewport)
    if (key !== nextKey) geometry = undefined
    key = nextKey
    if (!worker && !failed) {
      worker = import.meta.env.DEV ? new Worker('/hand-worker.js')
        : new Worker(new URL('./perception.worker.js', import.meta.url))
      worker.onmessage = ({ data }) => {
        busy = false
        if (data.error) { failed = data.error; reset(); return }
        inferenceMs = data.inferenceMs
        measured = true
        if (data.key === key && performance.now() - data.time <= maxAge) {
          geometry = handGeometry(data.detections, JSON.parse(data.key), geometry, data.time)
        } else staleResults++
      }
      worker.onerror = error => { failed = error.message || 'Worker 加载失败'; reset() }
    }
    if (geometry && now - geometry.time > maxAge) geometry = undefined
    if (worker && !busy && viewport.videoWidth && video.currentTime !== lastFrame && now - lastRequest >= 50) {
      const active = worker
      const requestKey = key
      busy = true
      lastFrame = video.currentTime
      lastRequest = now
      createImageBitmap(video).then(bitmap => {
        if (worker === active) worker.postMessage({ bitmap, time: now, key: requestKey }, [bitmap])
        else bitmap.close()
      }).catch(() => { if (worker === active) busy = false })
    }
    return geometry ? [...geometry.hands.values()].flatMap(hand => hand.patches.map(patch => ({ ...patch, captureTime: geometry.time }))) : []
  }

  function draw(ctx, impacts, relations = []) {
    if (!geometry) return
    ctx.save()
    for (const hand of geometry.hands.values()) {
      ctx.strokeStyle = ctx.fillStyle = hand.side === 'Left' ? '#7eeaff' : '#ffabdf'
      if (debug.landmarks.checked) {
        for (const point of hand.points) ctx.fillRect(point.x - 1, point.y - 1, 2, 2)
      }
      for (const patch of hand.patches) {
        if (!debug[patch.hand].checked) continue
        ctx.beginPath()
        ctx.ellipse(patch.center.x, patch.center.y, patch.radius.x, patch.radius.y, patch.angle, 0, 2 * Math.PI)
        ctx.stroke()
      }
      const palm = hand.patches.find(patch => patch.hand === 'palm')
      if (palm && debug.velocity.checked) {
        const center = world(palm, { x: 0, y: 0, z: 0 })
        ctx.beginPath()
        ctx.moveTo(center.x, center.y)
        ctx.lineTo(center.x + palm.velocity.x * .08, center.y + palm.velocity.y * .08)
        ctx.stroke()
      }
    }
    if (debug.impacts.checked) {
      ctx.fillStyle = '#fff2a1'
      for (const hit of impacts) if (hit.surface.startsWith('hand-')) ctx.fillRect(hit.x - 2, hit.y - 2, 4, 4)
    }
    if (debug.occlusion.checked) {
      for (const { palm, shoulder, order } of relations) {
        const shape = patch => {
          ctx.beginPath()
          ctx.ellipse(patch.center.x, patch.center.y, patch.radius.x, patch.radius.y, patch.angle, 0, Math.PI * 2)
        }
        ctx.strokeStyle = '#ffce7e'
        shape(shoulder)
        ctx.stroke()
        ctx.strokeStyle = '#7eeaff'
        shape(palm)
        ctx.stroke()
        ctx.save()
        ctx.clip()
        shape(shoulder)
        ctx.fillStyle = order === 'FRONT' ? '#7eeaff60' : order === 'BEHIND' ? '#a1ff8a50' : '#ffce7e55'
        ctx.fill()
        ctx.restore()
      }
      const event = candidates.at(-1)
      if (event) {
        ctx.strokeStyle = '#fff2a1'
        ctx.beginPath()
        ctx.moveTo(event.from.x, event.from.y)
        ctx.lineTo(event.to.x, event.to.y)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  function report(now, fps, collisionMs, renderMs, droplets, relations = []) {
    if (!enabled.checked || now - lastStatus < 400) return
    lastStatus = now
    if (failed) { status.textContent = '手部模型加载失败 · ' + failed + ' · 可关闭后重试'; return }
    if (!worker) return
    diagnostics.hidden = !debug.occlusion.checked
    if (debug.occlusion.checked) {
      const event = candidates.at(-1)
      diagnostics.textContent = [
        ...relations.map(r => `${r.palm.id} / ${r.shoulder.id} · ${r.order} / 置信度 ${r.confidence} · 肩膀仍参与碰撞 · 重叠飞溅透明度 ${r.opacity}`),
        ...(event ? [`粒子 #${event.id} → ${event.selected ?? '无接触'}`,
          ...event.candidates.map(c => `${c.type} ${c.reason}${c.position ? ` · ${c.timeMs.toFixed(1)} ms · (${c.position.x.toFixed(1)}, ${c.position.y.toFixed(1)})` : ''}`)] : []),
      ].join('\n') || '等待手掌与肩膀的候选接触'
    }
    logOutput.textContent = log.slice(-6).map(hit => `${hit.type} · #${hit.id} · (${hit.x.toFixed(1)}, ${hit.y.toFixed(1)})`).join('\n')
    const labels = ['Left', 'Right'].map(side => {
      const hand = geometry?.hands.get(side)
      const palm = hand?.patches.find(patch => patch.hand === 'palm')
      const speed = palm ? Math.hypot(palm.velocity.x, palm.velocity.y).toFixed(0) : '—'
      return `${side === 'Left' ? '左手' : '右手'} ${hand ? '已识别 ' + Math.round(hand.score * 100) + '%' : '未识别'} · ${hand?.points.length ?? 0} 点 · ${geometry && hand ? Math.round(now - geometry.time) + ' ms 前' : '—'} · 掌 ${palm ?
        `有效 (${palm.center.x.toFixed(1)}, ${palm.center.y.toFixed(1)}) · 朝向 ${(palm.angle * 180 / Math.PI).toFixed(0)}° · 投影法线 (${Math.sin(palm.angle).toFixed(2)}, ${(-Math.cos(palm.angle)).toFixed(2)})` : '停用'} · 指 ${hand?.patches.filter(patch => patch.hand === 'finger').length ?? 0} · ${speed} px/s`
    })
    status.textContent = [...labels, `碰撞 ${impactCount} · 掌心碰撞 ${palmCount} · 附着 ${droplets.filter(drop => drop.state === 'attached' && drop.patch.startsWith('hand-')).length} · 飞溅 ${droplets.filter(drop => drop.splash && drop.hand).length}`,
      `每秒 ${fps} 帧 · 手部推理 ${measured ? inferenceMs.toFixed(1) + ' ms' : '等待模型'} · 过期或错布局帧 ${staleResults} · 碰撞步进 ${collisionMs.toFixed(2)} ms · 绘制 ${renderMs.toFixed(2)} ms`].join('\n')
  }

  return { syncEnabled, current, draw, report, reset, impact, candidate, get inspecting() { return enabled.checked && debug.occlusion.checked } }
}
