const clamp = n => Math.max(0, Math.min(1, n))
const cross = (a, b) => a.x * b.y - a.y * b.x

// Use only contiguous columns of the hair class and leave isolated segmentation noise out.
export function hairEdges(boundary, rect) {
  if (!boundary || !rect) return []
  const edges = []
  const pixel = boundary.step
  for (let i = 1; i + 2 < boundary.values.length; i++) {
    const y = boundary.values[i]
    const next = boundary.values[i + 1]
    if (![boundary.values[i - 1], y, next, boundary.values[i + 2]].every(Number.isFinite)) continue
    const x = boundary.x + (i + .5) * pixel
    if (x < rect.x || x + pixel > rect.x + rect.width || Math.abs(next - y) > pixel * 4 ||
      Math.min(y, next) < rect.y || Math.max(y, next) > rect.y + rect.height) continue
    edges.push([{ x, y }, { x: x + pixel, y: next }])
  }
  return edges
}

export function faceEdges(face, rect) {
  if (!face || !rect) return []
  return face.points.flatMap((a, i, points) => {
    const b = points[(i + 1) % points.length]
    const side = (a.x + b.x) / 2 - face.center
    if (Math.abs(side) < face.margin * 3) return []
    const outward = Math.sign(side) * (face.margin + 4)
    const line = [{ x: a.x + outward, y: a.y }, { x: b.x + outward, y: b.y }]
    return line.every(p => p.x > rect.x + 2 && p.x < rect.x + rect.width - 2 &&
      p.y > rect.y + 2 && p.y < rect.y + rect.height - 2) ? [line] : []
  })
}

export function createAdaptiveRegions() {
  let weights = { crown: 0, hair: 0, face: 0 }
  let key
  let active = ''
  let changedAt = 0
  return (scene, rect, dt, now) => {
    if (scene.key !== key) {
      key = scene.key
      weights = { crown: 0, hair: 0, face: 0 }
    }
    const hair = hairEdges(scene.hairBoundary, rect)
    const face = faceEdges(scene.face, rect)
    const head = scene.headBounds
    const clearance = head && rect ? clamp((head.top - rect.y) / Math.max(1, (head.bottom - head.top) * .18)) : 0
    const visibleRatio = head && rect && head.bottom > head.top && head.right > head.left ?
      clamp((Math.min(head.bottom, rect.y + rect.height) - Math.max(head.top, rect.y)) / (head.bottom - head.top)) *
      clamp((Math.min(head.right, rect.x + rect.width) - Math.max(head.left, rect.x)) / (head.right - head.left)) : null
    const crown = scene.patches.some(patch => patch.id === 'head')
    const coverage = rect ? clamp(hair.length * (scene.hairBoundary?.step ?? 0) / (rect.width * .2)) : 0
    const targets = { crown: crown ? .65 + .35 * clearance : 0,
      hair: coverage * (crown ? 1 - clearance : 1),
      face: face.length ? (crown ? .15 : 1) * (1 - coverage * .8) : 0 }
    const blend = 1 - Math.exp(-dt / .2)
    weights = Object.fromEntries(Object.keys(targets).map(name => [name, weights[name] + (targets[name] - weights[name]) * blend]))
    const areas = [crown && '头顶', hair.length && weights.hair > .05 && '可见头发', face.length && weights.face > .05 && '脸侧'].filter(Boolean).join('、')
    if (areas !== active) { active = areas; changedAt = now }
    return { hair, face, weights, active, changedAt, clearance, visibleRatio, crown, center: scene.face?.center ?? (head ? (head.left + head.right) / 2 : rect?.width / 2) }
  }
}

export function adaptiveContact(regions, from, to, insideProtected) {
  if (!regions) return
  const move = { x: to.x - from.x, y: to.y - from.y }
  let first
  for (const kind of ['hair', 'face']) {
    const strength = regions.weights[kind]
    if (strength < .03) continue
    for (const [a, b] of regions[kind]) {
      if (Math.max(from.x, to.x) < Math.min(a.x, b.x) || Math.min(from.x, to.x) > Math.max(a.x, b.x) ||
        Math.max(from.y, to.y) < Math.min(a.y, b.y) || Math.min(from.y, to.y) > Math.max(a.y, b.y)) continue
      const edge = { x: b.x - a.x, y: b.y - a.y }
      const offset = { x: a.x - from.x, y: a.y - from.y }
      const det = cross(move, edge)
      if (Math.abs(det) < 1e-7) continue
      const t = cross(offset, edge) / det
      const u = cross(offset, move) / det
      if (t < 0 || t > 1 || u < 0 || u > 1 || first && t >= first.t) continue
      const point = { x: from.x + move.x * t, y: from.y + move.y * t, z: from.z }
      if (!insideProtected(point)) first = { t, point, kind, strength, direction: Math.sign(point.x - regions.center) || 1 }
    }
  }
  return first
}
