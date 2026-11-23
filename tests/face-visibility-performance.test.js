import { expect, test, vi } from 'vitest'
import { faceOpacity } from '../src/rain/visibility.js'
import { insideFace } from '../src/surface/quality.js'

function originalOpacity(face, from, to) {
  if (!face?.points.length) return 1
  let distance = Infinity
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

const face = {
  margin: 6,
  points: Array.from({ length: 36 }, (_, i) => ({
    x: 207 + Math.cos(i / 36 * Math.PI * 2) * 55,
    y: 300 + Math.sin(i / 36 * Math.PI * 2) * 90,
  })),
}

test('distant trajectories avoid expensive polygon distance calculations', () => {
  const hypot = vi.spyOn(Math, 'hypot')
  try {
    expect(faceOpacity(face, {x: 15, y: 10}, {x: 15, y: 750})).toBe(1)
    expect(hypot.mock.calls.length).toBeLessThanOrEqual(1)
  } finally { hypot.mockRestore() }
})

test('face opacity remains identical for stationary, crossing and near-edge trajectories', () => {
  let seed = 1201
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
  for (let i = 0; i < 2000; i++) {
    const from = {x: random() * 414, y: random() * 700}
    const to = i % 5 === 0 ? from : {x: from.x + (random() - .5) * 260, y: from.y + random() * 70}
    expect(faceOpacity(face, from, to)).toBe(originalOpacity(face, from, to))
  }
  // Crop adjustments can mutate existing coordinates, so cached bounds must not lag.
  const moving = { ...face, points: face.points.map(p => ({...p})) }
  for (const point of moving.points) point.x -= 180
  expect(faceOpacity(moving, {x: 25, y: 200}, {x: 25, y: 400})).toBe(0)
})
