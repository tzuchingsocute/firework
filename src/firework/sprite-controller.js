import { createSpriteFirework } from './sprite-firework.js'
import { createBurstScheduler } from './controller.js'

export function mountFirework(expressions) {
  const room = document.querySelector('.live-room')
  const video = room.querySelector('video')
  const canvas = document.createElement('canvas')
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.renderer = 'live-particles'
  canvas.dataset.visualVersion = 'starvoid-sprite'
  room.querySelector('.live-stage').append(canvas)
  const effect = createSpriteFirework(canvas)
  let width = 0
  let height = 0
  let count = 0
  let disposed = false
  let raf
  const resize = () => {
    const frame = room.getBoundingClientRect()
    width = frame.width
    height = frame.height
    effect.resize(width, height, window.devicePixelRatio || 1)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(room)
  window.addEventListener('resize', resize)
  resize()

  function trigger({ position, source = 'manual' } = {}) {
    if (disposed || document.hidden) return false
    // Existing callers use the scene's 414 × 896 design coordinates.
    const launched = effect.launch(
      position ? (position.x * width) / 414 : undefined,
      position ? (position.y * height) / 896 : undefined,
    )
    if (!launched) return false
    canvas.dataset.triggerCount = String(++count)
    canvas.dataset.groupCount = String(count)
    canvas.dataset.source = source
    canvas.dataset.lastHue = String(launched.hue)
    return true
  }
  const scheduler = createBurstScheduler(trigger)
  const visibility = () => {
    scheduler.step(expressions.snapshot, performance.now(), false)
    if (document.hidden) effect.clear()
  }
  document.addEventListener('visibilitychange', visibility)
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = '测试烟花（占位）'
  button.onclick = () => trigger()
  document
    .querySelector('#visual-rain [data-play]')
    .parentElement.append(button)

  function tick(now) {
    if (disposed) return
    const enabled =
      !document.hidden &&
      Boolean(
        video.srcObject
          ?.getVideoTracks()
          .some((track) => track.readyState === 'live'),
      )
    scheduler.step(expressions.snapshot, now, enabled)
    effect.step(now)
    const stats = effect.stats
    const activeCount = String(stats.active)
    const activeParticles = String(stats.sparks + stats.embers)
    if (canvas.dataset.activeCount !== activeCount)
      canvas.dataset.activeCount = activeCount
    if (canvas.dataset.activeParticles !== activeParticles)
      canvas.dataset.activeParticles = activeParticles
    raf = requestAnimationFrame(tick)
  }
  const controller = {
    trigger,
    get playing() {
      return effect.playing
    },
    get activeCount() {
      return effect.stats.active
    },
    stopScheduling() {
      scheduler.stopScheduling()
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      effect.dispose()
      button.remove()
      canvas.remove()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pagehide', controller.dispose)
      document.removeEventListener('visibilitychange', visibility)
    },
  }
  raf = requestAnimationFrame(tick)
  window.addEventListener('pagehide', controller.dispose, { once: true })
  return controller
}
