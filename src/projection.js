export function videoGeometry(width, height, videoWidth, videoHeight, mode = 'cover') {
  const [fit, anchor] = mode.split(':')
  const scale = (fit === 'contain' ? Math.min : Math.max)(width / videoWidth, height / videoHeight)
  const imageWidth = videoWidth * scale
  const imageHeight = videoHeight * scale
  const x = anchor === undefined ? (width - imageWidth) / 2
    : Math.min(0, Math.max(width - imageWidth, width / 2 - (1 - Number(anchor)) * imageWidth))
  return {
    scale, imageWidth, imageHeight, x, y: (height - imageHeight) / 2,
    cropX: Math.max(0, 1 - width / imageWidth), cropY: Math.max(0, 1 - height / imageHeight),
  }
}

export function projectPoints(points, width, height, videoWidth, videoHeight, mode = 'cover') {
  const { imageWidth, imageHeight, x, y } = videoGeometry(width, height, videoWidth, videoHeight, mode)
  return points.map(point => ({
    x: x + (1 - point.x) * imageWidth,
    y: y + point.y * imageHeight,
  }))
}

export const videoFit = video => video.dataset?.fit || 'contain'

export function visibleVideoRect(video, room, designWidth, designHeight) {
  const frame = room.getBoundingClientRect()
  const window = video.getBoundingClientRect()
  if (!frame.width || !frame.height || !window.width || !window.height) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  const image = video.videoWidth && video.videoHeight
    ? videoGeometry(window.width, window.height, video.videoWidth, video.videoHeight, videoFit(video))
    : { x: 0, y: 0, imageWidth: window.width, imageHeight: window.height }
  const left = Math.max(frame.left, window.left, window.left + image.x)
  const top = Math.max(frame.top, window.top, window.top + image.y)
  const right = Math.min(frame.right, window.right, window.left + image.x + image.imageWidth)
  const bottom = Math.min(frame.bottom, window.bottom, window.top + image.y + image.imageHeight)
  const sx = designWidth / frame.width
  const sy = designHeight / frame.height
  return {
    x: (left - frame.left) * sx, y: (top - frame.top) * sy,
    width: Math.max(0, right - left) * sx, height: Math.max(0, bottom - top) * sy,
  }
}
