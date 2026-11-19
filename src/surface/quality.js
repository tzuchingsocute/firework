import { projectPoints, videoFit } from '../projection.js'
import { contours } from '../tracker.js'

// The first contour is MediaPipe's ordered face oval.
const oval = contours.slice(0, 36).map(edge => edge.start)

export function facePolygon(points, video, width, height) {
  return points ? projectPoints(oval.map(index => points[index]), width, height, video.videoWidth, video.videoHeight, videoFit(video)) : null
}

export function facePath(points) {
  const path = new Path2D()
  points.forEach((point, index) => index ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y))
  path.closePath()
  return path
}

export function insideFace(points, position) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]
    const b = points[j]
    if ((a.y > position.y) !== (b.y > position.y)
      && position.x < (b.x - a.x) * (position.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function eraseFace(context, path, margin) {
  context.save()
  context.globalCompositeOperation = 'destination-out'
  context.lineJoin = 'round'
  for (let i = 5; i > 0; i--) {
    context.globalAlpha = .22
    context.lineWidth = 2 * (margin + i)
    context.stroke(path)
  }
  context.globalAlpha = 1
  context.lineWidth = 2 * margin
  context.stroke(path)
  context.fill(path)
  context.restore()
}

export function createEffectMeasurement() {
  const effect = document.createElement('canvas')
  const mask = document.createElement('canvas')
  const context = effect.getContext('2d', { willReadFrequently: true })
  const reference = mask.getContext('2d', { willReadFrequently: true })
  return {
    context,
    begin(canvas, width, height) {
      for (const layer of [effect, mask]) {
        if (layer.width !== canvas.width) layer.width = canvas.width
        if (layer.height !== canvas.height) layer.height = canvas.height
      }
      for (const layer of [context, reference]) {
        layer.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
        layer.clearRect(0, 0, width, height)
      }
    },
    protect(path, margin, width, height) {
      if (!path) { context.clearRect(0, 0, width, height); return }
      eraseFace(context, path, margin)
    },
    composite(target, width, height) {
      target.drawImage(effect, 0, 0, width, height)
    },
    measure(points, video, width, height) {
      if (!points) return null
      const projected = projectPoints(oval.map(index => points[index]), width, height, video.videoWidth, video.videoHeight, videoFit(video))
      reference.beginPath()
      projected.forEach((point, index) => index ? reference.lineTo(point.x, point.y) : reference.moveTo(point.x, point.y))
      reference.closePath()
      reference.fill()
      const pixels = context.getImageData(0, 0, effect.width, effect.height).data
      const face = reference.getImageData(0, 0, mask.width, mask.height).data
      let area = 0
      let covered = 0
      let maxAlpha = 0
      for (let i = 3; i < face.length; i += 4) {
        if (!face[i]) continue
        area++
        if (pixels[i]) covered++
        maxAlpha = Math.max(maxAlpha, pixels[i])
      }
      return area ? { area, covered, maxAlpha, percent: 100 * covered / area, reference: projected } : null
    },
  }
}
