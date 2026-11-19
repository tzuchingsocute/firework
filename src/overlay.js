import { projectPoints, videoFit } from './projection.js'
import { contours } from './tracker.js'

export function createOverlay(canvas, video) {
  const context = canvas.getContext('2d')

  return function draw(points) {
    const { width, height } = canvas.getBoundingClientRect()
    const density = window.devicePixelRatio || 1
    const pixelWidth = Math.round(width * density)
    const pixelHeight = Math.round(height * density)
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight
    context.setTransform(density, 0, 0, density, 0, 0)
    context.clearRect(0, 0, width, height)
    if (!points?.length || !video.videoWidth || !video.videoHeight) return

    const projected = projectPoints(points, width, height, video.videoWidth, video.videoHeight, videoFit(video))

    context.beginPath()
    for (const { start, end } of contours) {
      context.moveTo(projected[start].x, projected[start].y)
      context.lineTo(projected[end].x, projected[end].y)
    }
    context.strokeStyle = '#65fff3'
    context.lineWidth = 1.25
    context.stroke()

    context.fillStyle = '#dafffb'
    for (const { x, y } of projected) context.fillRect(x - 0.7, y - 0.7, 1.4, 1.4)
  }
}
