export function sprite(w, h, stops, vertical = false) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const gradient = vertical ? ctx.createLinearGradient(0, 0, 0, h)
    : ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  for (const [stop, color] of stops) gradient.addColorStop(stop, color)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
  return canvas
}

export function createOriginalDroplet(ctx) {
  const core = sprite(32, 32, [[0, '#fff'], [.36, '#f1fbff'], [.7, '#caebff90'], [1, '#c5ebff00']])
  const glow = sprite(32, 32, [[0, '#b5e4ffb0'], [.35, '#9bd5ff51'], [1, '#8acbff00']])
  const trail = sprite(4, 64, [[0, '#bde9ff00'], [.35, '#bde9ff18'], [.73, '#cbefff55'], [1, '#e1f5fff0']], true)
  return (drop, radius, alpha, length, params) => {
    const { x, y } = drop
    if (length > 0 && params.trailOpacity > 0) {
      ctx.globalAlpha = alpha * params.trailOpacity
      const slope = -drop.vx / drop.vy
      ctx.setTransform(1, 0, -slope, 1, x, y)
      ctx.drawImage(trail, -radius * .55, -length, radius * 1.1, length)
      ctx.resetTransform()
    }
    if (params.glow > 0) {
      ctx.globalAlpha = alpha * params.glow
      ctx.drawImage(glow, x - radius * 3.4, y - radius * 3.4, radius * 6.8, radius * 6.8)
    }
    ctx.globalAlpha = alpha
    ctx.drawImage(core, x - radius, y - radius * 1.25, radius * 2, radius * 2.5)
    ctx.globalAlpha = 1
  }
}
