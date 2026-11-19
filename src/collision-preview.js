import { headMaskEdges } from './head-segmentation.js'
import { advanceParticle, estimateHead, seedParticles } from './head-space.js'
import { projectPoints, videoFit, videoGeometry } from './projection.js'
import { firstContact, convexHull } from './head-collision.js'

export function createCollisionPreview(video) {
  const canvas = document.querySelector('#collision-preview')
  const controls = document.querySelector('#collision-controls')
  const enabled = document.querySelector('#collision-enabled')
  const outline = document.querySelector('#collision-outline')
  const seed = document.querySelector('#collision-seed')
  const metrics = document.querySelector('#head-space')
  const fire = document.querySelector('#collision-fire')
  const feedback = document.querySelector('#collision-feedback')
  const debug = document.querySelector('#debug')
  const ctx = canvas.getContext('2d')
  let lastMask
  let normalEdges
  let boundary
  let particles = []
  let surrounding = []
  let head
  let lastRenderedHead
  let lastMetricsTime = 0
  let previousTime
  function reset() {
    lastMask = normalEdges = undefined
    boundary = undefined
    head = lastRenderedHead = undefined
    surrounding = []
    seed.disabled = true
    metrics.textContent = '等待头部追踪'
    particles = []
    previousTime = undefined
    fire.disabled = true
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  debug.addEventListener('change', () => {
    controls.hidden = !debug.checked
    canvas.hidden = !debug.checked || !enabled.checked
    if (!debug.checked) reset()
  })
  enabled.addEventListener('change', () => {
    canvas.hidden = !enabled.checked
    reset()
  })

  seed.addEventListener('click', () => {
    if (boundary) surrounding = seedParticles(boundary.hull, head, boundary.width, boundary.height)
  })

  fire.addEventListener('click', () => {
    if (!boundary) return
    const { hull, points } = boundary
    const top = Math.min(...hull.map(p => p.y))
    const bottom = Math.max(...hull.map(p => p.y))
    const minX = Math.min(...hull.map(p => p.x))
    const maxX = Math.max(...hull.map(p => p.x))
    const nose = points[1]
    particles = [
      { x: (minX + maxX) / 2, y: top - 52, vx: 0, vy: 180, bounce: true },
      { x: minX - 48, y: nose.y, vx: 210, vy: 0 },
      { x: maxX + 48, y: nose.y, vx: -210, vy: 0 },
      { x: points[152].x, y: bottom + 50, vx: 0, vy: -180 },
      { x: minX - 48, y: points[168].y, vx: 240, vy: 0, behind: true },
    ].map(p => ({ ...p, life: 2.2 }))
  })

  function render(now) {
    if (!boundary || canvas.hidden) return
    const { hull, width, height } = boundary
    const density = window.devicePixelRatio || 1
    const w = Math.round(width * density)
    const h = Math.round(height * density)
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const dt = previousTime === undefined ? 0 : Math.min((now - previousTime) / 1000, .05)
    previousTime = now
    ctx.setTransform(density, 0, 0, density, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const movement = lastRenderedHead && head.time !== lastRenderedHead.time
      && head.time - lastRenderedHead.time <= 250
      ? { x: head.headX - lastRenderedHead.headX, y: head.headY - lastRenderedHead.headY }
      : undefined
    lastRenderedHead = head
    surrounding = surrounding.map(p => advanceParticle(p, hull, head, dt, movement))
    for (const p of surrounding) {
      if (p.x < 3 && p.vx < 0 || p.x > width - 3 && p.vx > 0) p.vx *= -.4
      if (p.y < 3 && p.vy < 0 || p.y > height - 3 && p.vy > 0) p.vy *= -.4
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = p.affected ? '#ffca67' : '#acf3ef'
      ctx.fill()
    }
    if (now - lastMetricsTime >= 100) {
      const n = value => value.toFixed(1)
      metrics.textContent = [
        `追踪中 · 头部位置与姿态为估计值 · 受影响粒子 ${surrounding.filter(p => p.affected).length}`,
        `Head X / Y ${n(head.headX)} / ${n(head.headY)} px · Width / Height ${n(head.width)} / ${n(head.height)} px · 缩放 ${head.scale.toFixed(2)}×`,
        `Yaw / Pitch / Roll ${n(head.yaw)}° / ${n(head.pitch)}° / ${n(head.roll)}°`,
        `Velocity X / Y ${n(head.velocityX)} / ${n(head.velocityY)} px/s · 速度 ${n(head.speed)} px/s · 方向 ${head.direction === null ? '—' : n(head.direction) + '°'}`,
      ].join('\n')
      lastMetricsTime = now
    }
    for (const p of particles) {
      if (p.life <= 0) continue
      p.life -= dt
      const next = { x: p.x + p.vx * dt, y: p.y + p.vy * dt }
      const hit = p.behind ? null : firstContact(hull, p, next)
      if (hit) {
        if (!p.bounce || !hit.normal) { p.life = 0; continue }
        const { normal, time } = hit
        const inward = p.vx * normal.x + p.vy * normal.y
        p.x += p.vx * dt * time + normal.x * 3
        p.y += p.vy * dt * time + normal.y * 3
        p.vx -= 1.7 * inward * normal.x
        p.vy -= 1.7 * inward * normal.y
      } else {
        Object.assign(p, next)
      }
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI)
      ctx.fillStyle = p.behind ? '#bbadff' : '#ffd166'
      ctx.fill()
    }

    ctx.beginPath()
    hull.forEach(({ x, y }, i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.closePath()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    if (!outline.checked) return
    ctx.strokeStyle = '#ffca67'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 4])
    ctx.stroke()
  }

  return {
    update(points, time, frame) {
      if (canvas.hidden) return
      if (!points || video.paused) { reset(); return }
      const { width, height } = video.getBoundingClientRect()
      const projected = projectPoints(points, width, height, video.videoWidth, video.videoHeight, videoFit(video))
      // MediaPipe z uses the same scale as normalized video x.
      const geometry = videoGeometry(width, height, video.videoWidth, video.videoHeight, videoFit(video))
      const depthScale = geometry.imageWidth
      const spatial = projected.map((point, index) => ({
        ...point, z: points[index].z * depthScale,
      }))
      if (frame?.mask !== lastMask) {
        lastMask = frame?.mask
        normalEdges = frame ? headMaskEdges(frame.mask, frame.maskWidth, frame.maskHeight, points) : null
      }
      const hull = normalEdges && convexHull(projectPoints(normalEdges, width, height,
        video.videoWidth, video.videoHeight, videoFit(video)))
      feedback.textContent = hull ? '头发与面部区域' : '等待有效头部区域'
      if (!hull) {
        boundary = undefined
        head = lastRenderedHead = undefined
        surrounding = []
        particles = []
        fire.disabled = seed.disabled = true
        metrics.textContent = '等待有效头部区域'
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }
      if (hull.length < 3) { reset(); return }
      const resized = boundary && (boundary.width !== width || boundary.height !== height)
      if (resized) lastRenderedHead = undefined
      if (boundary && !resized && geometry.x !== boundary.offsetX) {
        const shift = geometry.x - boundary.offsetX
        if (head) head.headX += shift
        if (lastRenderedHead && lastRenderedHead !== head) lastRenderedHead.headX += shift
        for (const particle of [...surrounding, ...particles]) particle.x += shift
      }
      head = estimateHead(spatial, hull, time, resized ? undefined : head)
      if (!boundary || resized) surrounding = seedParticles(hull, head, width, height)
      boundary = { hull, points: spatial, width, height, offsetX: geometry.x }
      seed.disabled = false
      fire.disabled = false
      },
    render,
    reset,
  }
}
