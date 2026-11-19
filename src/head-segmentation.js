export function headMaskEdges(data, w, h, landmarks) {
  const nose = landmarks[1]
  // Pick the connected head region nearest the tracked face.
  let seed = -1
  let distance = Infinity
  for (let i = 0; i < data.length; i++) {
    if (data[i] !== 1 && data[i] !== 3) continue
    const d = (i % w / w - nose.x) ** 2 + (Math.floor(i / w) / h - nose.y) ** 2
    if (d < distance) { seed = i; distance = d }
  }
  if (seed < 0 || distance > .04) { return null }
  const visited = new Uint8Array(data.length)
  const queue = [seed]
  visited[seed] = 1
  const edge = []
  for (let at = 0; at < queue.length; at++) {
    const i = queue[at]
    const x = i % w
    const y = Math.floor(i / w)
    let boundary = x === 0 || x === w - 1 || y === 0 || y === h - 1
    const neighbors = []
    if (x > 0) neighbors.push(i - 1)
    if (x < w - 1) neighbors.push(i + 1)
    if (y > 0) neighbors.push(i - w)
    if (y < h - 1) neighbors.push(i + w)
    for (const next of neighbors) {
      if (data[next] !== 1 && data[next] !== 3) { boundary = true; continue }
      if (!visited[next]) { visited[next] = 1; queue.push(next) }
    }
    if (boundary) edge.push({ x: (x + .5) / w, y: (y + .5) / h })
  }
  // Hair can be disconnected from face skin by shadows, fringe, or mask gaps.
  // Merge nearby hair pixels independently of the face component.
  const chin = landmarks[152]
  const brow = landmarks[10]
  const faceHeight = Math.hypot((chin.x - brow.x) * w, (chin.y - brow.y) * h)
  const faceXs = landmarks.map(point => point.x * w)
  const minX = Math.min(...faceXs) - faceHeight * .6
  const maxX = Math.max(...faceXs) + faceHeight * .6
  const minY = Math.min(...landmarks.map(point => point.y * h)) - faceHeight
  const maxY = Math.max(...landmarks.map(point => point.y * h))
  for (let y = Math.max(0, Math.floor(minY)); y < Math.min(h, Math.ceil(maxY)); y++) {
    for (let x = Math.max(0, Math.floor(minX)); x < Math.min(w, Math.ceil(maxX)); x++) {
      if (data[y * w + x] === 1) edge.push({ x: (x + .5) / w, y: (y + .5) / h })
    }
  }
  return edge.length >= 3 ? edge : null
}
