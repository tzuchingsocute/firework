import {
  createFinalLiveFirework,
  paintFinalLiveFirework,
  disposeFinalLiveFirework,
} from './final-live-firework.js'
import { createGroupScheduler } from './group-composition.js'
import { visibleVideoRect, projectPoints, videoFit } from '../projection.js'

// One RAF-driven scheduler: no timers, queued bursts or catch-up loops.
export function createBurstScheduler(trigger, interval = 1300) {
  let next,
    last = -Infinity,
    stopped = false
  return {
    stopScheduling() {
      next = undefined
      stopped = true
    },
    step(snapshot, now, enabled = true) {
      if (
        !enabled ||
        !snapshot.faceDetected ||
        snapshot.state !== 'LAUGH' ||
        now - snapshot.timestamp > 750
      ) {
        next = undefined
        stopped = false
        return
      }
      if (stopped) return
      next ??= Math.max(now, last + interval)
      if (now < next) return
      trigger({ source: 'laugh' })
      last = now
      next = now + interval
    },
  }
}

export function mountFirework(expressions) {
  const room = document.querySelector('.live-room')
  const video = room.querySelector('video')
  const canvas = document.createElement('canvas')
  canvas.width = 414
  canvas.height = 896
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.renderer = 'live-particles'
  canvas.dataset.visualVersion = 'final-confirmed'
  room.querySelector('.live-stage').append(canvas)
  const ctx = canvas.getContext('2d')
  let active = []
  let count = 0
  let raf
  let disposed = false
  let needsClear = true
  const paletteOffset = Math.floor(Math.random() * 4)
  const live = (now) =>
    active.filter((item) => now - item.start < item.particles.duration)
  const prune = (now) => {
    for (const item of active)
      if (now - item.start >= item.particles.duration)
        disposeFinalLiveFirework(item.particles)
    active = live(now)
  }
  let faceLandmarks = null
  let faceTime = -Infinity
  const context = (
    roomRect = room.getBoundingClientRect(),
    videoRect = video.getBoundingClientRect(),
  ) => {
    const bounds = visibleVideoRect(video, room, 414, 896, roomRect, videoRect)
    let face = null
    if (faceLandmarks && performance.now() - faceTime < 750) {
      if (videoRect.width && roomRect.width) {
        const points = projectPoints(
          faceLandmarks,
          videoRect.width,
          videoRect.height,
          video.videoWidth || videoRect.width,
          video.videoHeight || videoRect.height,
          videoFit(video),
        )
        const xs = points.map(
          (point) => ((videoRect.x - roomRect.x + point.x) * 414) / roomRect.width,
        )
        const ys = points.map(
          (point) => ((videoRect.y - roomRect.y + point.y) * 896) / roomRect.height,
        )
        face = {
          x: (Math.min(...xs) + Math.max(...xs)) / 2,
          y: (Math.min(...ys) + Math.max(...ys)) / 2,
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        }
      }
    }
    return { bounds, face, seed: count + paletteOffset }
  }
  const load = () => {
    let particles = 0
    let peakMains = 0
    let reservedParticles = 0
    const now = performance.now()
    for (const item of active) {
      const age = (now - item.start) / 1000
      const census = item.particles.census(age)
      reservedParticles += census.reservedParticles
      particles += census.particles
      if (item.role === 'main' && age < 0.95) peakMains++
    }
    return {
      instances: live(now).length,
      particles,
      peakMains,
      reservedParticles,
    }
  }
  const minimumCosts = new Map()
  const scheduler = createGroupScheduler({
    load,
    spawn(item, now) {
      if (disposed) return false
      const available = scheduler.config.particleBudget - load().reservedParticles
      const key = item.role + ':' + item.seed
      if ((minimumCosts.get(key) || 0) > available) return false
      const particles = createFinalLiveFirework(item.seed, {
        role: item.role,
        available,
      })
      if (!particles.accepted) {
        minimumCosts.set(key, particles.minimumReservation)
        if (minimumCosts.size > 128)
          minimumCosts.delete(minimumCosts.keys().next().value)
        return false
      }
      minimumCosts.delete(key)
      active.push({ ...item, particles, start: now })
      return true
    },
  })
  const controller = {
    get playing() {
      return live(performance.now()).length > 0
    },
    get activeCount() {
      return live(performance.now()).length
    },
    updateFace(points) {
      faceLandmarks = points?.length ? points : null
      faceTime = performance.now()
    },
    stopScheduling() {
      scheduler.stopScheduling()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      scheduler.dispose()
      for (const item of active) disposeFinalLiveFirework(item.particles)
      active = []
      button.remove()
      canvas.remove()
      document.removeEventListener('visibilitychange', visibility)
    },
    trigger({
      position,
      source = 'manual',
      seed = count + paletteOffset,
    } = {}) {
      if (disposed || document.hidden) return false
      prune(performance.now())
      const c = { ...context(), position, seed }
      if (!c.bounds.width || !c.bounds.height) return false
      const accepted = scheduler.trigger(performance.now(), c, source)
      if (accepted) {
        count++
        canvas.dataset.triggerCount = String(scheduler.stats.groups)
        canvas.dataset.source = source
        canvas.dataset.groupHistory = JSON.stringify(scheduler.stats.history)
      }
      return accepted
    },
  }
  const visibility = () => {
    if (document.hidden) scheduler.stopScheduling()
    else
      scheduler.step(expressions.snapshot, performance.now(), context(), false)
  }
  document.addEventListener('visibilitychange', visibility)
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = '测试烟花（占位）'
  button.onclick = () => controller.trigger({ source: 'manual' })
  document
    .querySelector('#visual-rain [data-play]')
    .parentElement.append(button)
  function tick(now) {
    if (disposed) return
    prune(now)
    const enabled =
      !document.hidden &&
      Boolean(
        video.srcObject
          ?.getVideoTracks()
          .some((track) => track.readyState === 'live'),
      )
    const frame = room.getBoundingClientRect()
    const videoFrame = video.getBoundingClientRect()
    const scene = context(frame, videoFrame)
    const before = scheduler.stats.groups
    scheduler.step(expressions.snapshot, now, scene, enabled)
    if (scheduler.stats.groups > before) {
      count++
      canvas.dataset.triggerCount = String(scheduler.stats.groups)
      canvas.dataset.source = 'laugh'
      canvas.dataset.groupHistory = JSON.stringify(scheduler.stats.history)
    }
    const density = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(frame.width * density))
    const height = Math.max(1, Math.round(frame.height * density))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    if (active.length || needsClear) {
      ctx.setTransform(canvas.width / 414, 0, 0, canvas.height / 896, 0, 0)
      ctx.clearRect(0, 0, 414, 896)
      for (const item of active)
        paintFinalLiveFirework(
          ctx,
          item.particles,
          now - item.start,
          item.position,
          scene.bounds,
          item.scale,
        )
      needsClear = active.length > 0
    }
    canvas.dataset.activeCount = String(active.length)
    canvas.dataset.groupCount = String(scheduler.stats.groups)
    canvas.dataset.pendingCount = String(scheduler.pendingCount)
    const census = load()
    canvas.dataset.peakMains = String(census.peakMains)
    canvas.dataset.activeParticles = String(census.particles)
    canvas.dataset.reservedParticles = String(census.reservedParticles)
    canvas.dataset.skippedSupports = String(scheduler.stats.skippedSupports)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  window.addEventListener('pagehide', () => controller.dispose(), {
    once: true,
  })
  return controller
}
