const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)

export function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const chain = order => {
    const edge = []
    for (const point of order) {
      while (edge.length > 1 && cross(edge.at(-2), edge.at(-1), point) <= 0) edge.pop()
      edge.push(point)
    }
    return edge.slice(0, -1)
  }
  return [...chain(sorted), ...chain(sorted.reverse())]
}

export function headBoundary(points, crown) {
  const brow = points[10]
  const chin = points[152]
  const height = Math.hypot(brow.x - chin.x, brow.y - chin.y)
  if (!height) return convexHull(points)

  // A closer chin relative to the forehead indicates upward pitch.
  const pitch = Number.isFinite(brow.z - chin.z) ? (brow.z - chin.z) / height : 0
  const compensation = Math.max(.025, .12 - Math.max(0, pitch) * .35)
  const top = crown ?? {
    x: brow.x + (brow.x - chin.x) * compensation,
    y: brow.y + (brow.y - chin.y) * compensation,
  }
  return convexHull([...points, top])
}

// Clip the entire particle path against the convex boundary, including fast crossings.
export function firstContact(hull, from, to) {
  let enter = 0
  let leave = 1
  let normal
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]
    const b = hull[(i + 1) % hull.length]
    const start = cross(a, b, from)
    const end = cross(a, b, to)
    if (start < 0 && end < 0) return null
    if (start < 0) {
      const time = start / (start - end)
      if (time >= enter) {
        enter = time
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        normal = { x: (b.y - a.y) / length, y: (a.x - b.x) / length }
      }
    } else if (end < 0) {
      leave = Math.min(leave, start / (start - end))
    }
    if (enter > leave) return null
  }
  return { time: enter, normal }
}
