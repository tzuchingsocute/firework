import { firstContact } from './head-collision.js'

const degrees = radians => radians * 180 / Math.PI

// Landmark-derived angle estimates in the mirrored screen coordinate system.
export function estimateHead(points, hull, time, previous) {
  const left = points[263]
  const right = points[33]
  const brow = points[10]
  const chin = points[152]
  const roll = Math.atan2(right.y - left.y, right.x - left.x)
  const cos = Math.cos(roll)
  const sin = Math.sin(roll)
  const local = hull.map(({ x, y }) => ({ x: cos * x + sin * y, y: -sin * x + cos * y }))
  const xs = local.map(p => p.x)
  const ys = local.map(p => p.y)
  const bounds = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const x = (bounds[0] + bounds[1]) / 2
  const y = (bounds[2] + bounds[3]) / 2
  const headX = cos * x - sin * y
  const headY = sin * x + cos * y
  const width = bounds[1] - bounds[0]
  const height = bounds[3] - bounds[2]
  const dt = previous ? (time - previous.time) / 1000 : 0
  const velocityX = dt > 0 && dt <= .25 ? (headX - previous.headX) / dt : 0
  const velocityY = dt > 0 && dt <= .25 ? (headY - previous.headY) / dt : 0
  const speed = Math.hypot(velocityX, velocityY)
  const size = Math.hypot(width, height)
  const referenceSize = previous?.referenceSize || size
  return { headX, headY, width, height, time, referenceSize, scale: size / (referenceSize || 1),
    yaw: degrees(Math.atan2(right.z - left.z, Math.hypot(right.x - left.x, right.y - left.y))),
    pitch: degrees(Math.atan2(brow.z - chin.z, Math.hypot(brow.x - chin.x, brow.y - chin.y))),
    roll: degrees(roll), velocityX, velocityY, speed,
    direction: speed >= 1 ? degrees(Math.atan2(velocityY, velocityX)) : null }
}

export function seedParticles(hull, head, width, height) {
  return Array.from({ length: 16 }, (_, index) => {
    const angle = index * Math.PI / 8
    const nx = Math.cos(angle)
    const ny = Math.sin(angle)
    const radius = Math.max(...hull.map(p => (p.x - head.headX) * nx + (p.y - head.headY) * ny)) + 12 + index % 3 * 7
    const x = Math.max(4, Math.min(width - 4, head.headX + nx * radius))
    const y = Math.max(4, Math.min(height - 4, head.headY + ny * radius))
    return { x, y, vx: 0, vy: 0 }
  }).filter(p => !firstContact(hull, p, p))
}

function nearestExit(hull, point) {
  let best = { distance: Infinity }
  for (let index = 0; index < hull.length; index++) {
    const a = hull[index]
    const b = hull[(index + 1) % hull.length]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const x = (b.y - a.y) / length
    const y = (a.x - b.x) / length
    const distance = (a.x - point.x) * x + (a.y - point.y) * y
    if (distance < best.distance) best = { x, y, distance }
  }
  return best
}

export function advanceParticle(particle, hull, head, dt, movement = { x: 0, y: 0 }) {
  const next = { x: particle.x + particle.vx * dt, y: particle.y + particle.vy * dt }
  const from = { x: particle.x + movement.x, y: particle.y + movement.y }
  const contact = firstContact(hull, from, next)
  const damping = Math.exp(-5 * dt)
  let vx = particle.vx * damping
  let vy = particle.vy * damping
  if (contact) {
    const position = { x: from.x + (next.x - from.x) * contact.time, y: from.y + (next.y - from.y) * contact.time }
    const normal = contact.normal ?? nearestExit(hull, position)
    const distance = (normal.distance ?? 0) + 4
    next.x = position.x + normal.x * distance
    next.y = position.y + normal.y * distance
    const push = Math.min(850, Math.max(35, (head.velocityX * normal.x + head.velocityY * normal.y) * .8))
    vx = normal.x * push
    vy = normal.y * push
  }
  return { ...next, vx, vy, affected: Boolean(contact) || Math.hypot(vx, vy) > 10 }
}
