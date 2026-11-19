import { expect, it } from 'vitest'
import { convexHull, firstContact, headBoundary } from '../src/head-collision.js'
import { advanceParticle, estimateHead, seedParticles } from '../src/head-space.js'

function sample({ x = 140, y = 180, scale = 1, angle = 0, yaw = 0, pitch = 0 } = {}, time = 0, previous) {
  const radians = angle * Math.PI / 180
  const points = Array.from({ length: 478 }, (_, i) => {
    const a = i * Math.PI * 2 / 478
    return { x: 30 * Math.cos(a), y: 50 * Math.sin(a), z: 0 }
  })
  points[10] = { x: 0, y: -50, z: pitch }
  points[152] = { x: 0, y: 50, z: -pitch }
  points[263] = { x: -16, y: -15, z: -yaw }
  points[33] = { x: 16, y: -15, z: yaw }
  const transformed = points.map(p => ({
    x: x + scale * (p.x * Math.cos(radians) - p.y * Math.sin(radians)),
    y: y + scale * (p.x * Math.sin(radians) + p.y * Math.cos(radians)),
    z: p.z * scale,
  }))
  const hull = headBoundary(transformed)
  return { ...estimateHead(transformed, hull, time, previous), hull }
}

it('head center tracks horizontal and vertical changes', () => {
  const a = sample()
  const b = sample({ x: 165, y: 195 })
  expect(b.headX - a.headX).toBeCloseTo(25)
  expect(b.headY - a.headY).toBeCloseTo(15)
})

it('head dimensions and relative scale follow camera distance', () => {
  const a = sample()
  const b = sample({ scale: 1.5 }, 16, a)
  expect(b.width / a.width).toBeCloseTo(1.5)
  expect(b.height / a.height).toBeCloseTo(1.5)
  expect(b.scale).toBeCloseTo(1.5)
})

it('reports roll, signed depth-based angles, and a rotated hull', () => {
  const a = sample()
  const b = sample({ angle: 30 })
  const c = sample({ yaw: 6, pitch: 10 })
  expect(b.roll).toBeCloseTo(30)
  expect(b.width).toBeCloseTo(a.width)
  expect(b.hull[0].y).not.toBeCloseTo(a.hull[0].y)
  expect(c.yaw).toBeGreaterThan(0)
  expect(c.pitch).toBeGreaterThan(0)
})

it('uses elapsed milliseconds and drops velocity across a long gap', () => {
  const a = sample({}, 500)
  const b = sample({ x: 160, y: 190 }, 600, a)
  const c = sample({ x: 180, y: 200 }, 700, b)
  const d = sample({ x: 200 }, 1000, c)
  expect(b.velocityX).toBeCloseTo(200)
  expect(b.velocityY).toBeCloseTo(100)
  expect(c.speed).toBeCloseTo(b.speed)
  expect(b.direction).toBeCloseTo(26.565)
  expect(d.velocityX).toBe(0)
})

it('moves the collision boundary and only seeds outside it', () => {
  const a = sample()
  const b = sample({ x: 175 })
  expect(Math.min(...b.hull.map(p => p.x)) - Math.min(...a.hull.map(p => p.x))).toBeCloseTo(35)
  const particles = seedParticles(b.hull, b, 414, 896)
  expect(particles).toHaveLength(16)
  expect(particles.every(p => !firstContact(b.hull, p, p))).toBe(true)
})

it('pushes particles harder at higher head speed, resolves overlap and damps motion', () => {
  const hull = convexHull([{x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 10}, {x: 0, y: 10}])
  const particle = { x: 8, y: 5, vx: 0, vy: 0 }
  const fast = advanceParticle(particle, hull, { velocityX: 400, velocityY: 0 }, .016)
  const slow = advanceParticle(particle, hull, { velocityX: 80, velocityY: 0 }, .016)
  expect(fast.vx).toBeGreaterThan(slow.vx)
  expect(fast.affected).toBe(true)
  expect(firstContact(hull, fast, fast)).toBeNull()
  expect(advanceParticle(fast, hull, { velocityX: 0, velocityY: 0 }, .1).vx).toBeLessThan(fast.vx)
  const swept = advanceParticle({ ...particle, x: -10 }, hull, { velocityX: 400, velocityY: 0 }, .016, { x: 30, y: 0 })
  expect(swept.x).toBeGreaterThan(10)
  expect(swept.affected).toBe(true)
})
