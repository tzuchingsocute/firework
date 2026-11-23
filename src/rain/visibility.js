import { insideFace } from '../surface/quality.js'
import { videoGeometry } from '../projection.js'

export function faceOpacity(face, from, to) {
  if (!face?.points.length) return 1
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const point of face.points) {
    left = Math.min(left, point.x)
    right = Math.max(right, point.x)
    top = Math.min(top, point.y)
    bottom = Math.max(bottom, point.y)
  }
  // Only skip trajectories beyond the entire fade region. Nearby sweeps retain
  // the original sampling and distance calculation, including fast crossings.
  const padding = Math.max(0, face.margin + 12)
  if (Math.max(from.x, to.x) < left - padding || Math.min(from.x, to.x) > right + padding ||
      Math.max(from.y, to.y) < top - padding || Math.min(from.y, to.y) > bottom + padding) return 1
  let distance = Infinity
  // Subsample the swept segment so a slow frame cannot skip the protected core.
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 6))
  for (let step = 0; step <= steps; step++) {
    const point = { x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps }
    if (insideFace(face.points, point)) return 0
    for (let i = 0; i < face.points.length; i++) {
      const a = face.points[i]
      const b = face.points[(i + 1) % face.points.length]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
      distance = Math.min(distance, Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t))
    }
  }
  return Math.max(0, Math.min(1, (distance - face.margin) / 12))
}

export function keepVisible(drop, face, from, to) {
  if (drop.visuallyTerminated) return false
  drop.visibility = Math.min(drop.visibility ?? 1, faceOpacity(face, from, to))
  if (drop.visibility > 0) return true
  drop.visuallyTerminated = true
  return false
}

export function createPersonOcclusion() {
  const mask = document.createElement('canvas')
  const brush = mask.getContext('2d')
  let last
  return (ctx, scene, sx, sy, debug = false) => {
    const frame = scene.personMask
    if (!frame) return
    if (last !== frame) {
      mask.width = frame.maskWidth
      mask.height = frame.maskHeight
      const image = brush.createImageData(mask.width, mask.height)
      for (let i = 0; i < frame.mask.length; i++) {
        const category = frame.mask[i]
        if (category < 1 || category > 5) continue
        image.data[i * 4] = 88
        image.data[i * 4 + 1] = 214
        image.data[i * 4 + 2] = 255
        image.data[i * 4 + 3] = 255
      }
      brush.putImageData(image, 0, 0)
      last = frame
    }
    const image = videoGeometry(scene.width, scene.stageHeight, frame.videoWidth, frame.videoHeight, frame.mode)
    ctx.save()
    ctx.translate((image.x + image.imageWidth) * sx, (scene.stageTop + image.y) * sy)
    ctx.scale(-1, 1)
    ctx.imageSmoothingEnabled = true
    ctx.globalCompositeOperation = debug ? 'source-over' : 'destination-out'
    ctx.globalAlpha = debug ? .24 : 1
    ctx.drawImage(mask, 0, 0, image.imageWidth * sx, image.imageHeight * sy)
    ctx.restore()
  }
}
