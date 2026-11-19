import { it, expect } from 'vitest'
import { intersect, world, local, normal, stepDrops } from '../src/surface/physics.js'
import { buildSurface, maskAt } from '../src/surface/model.js'
const patch = { id: 'head', center: { x: 100, y: 100, z: 0 }, radius: { x: 40, y: 50, z: 30 },
  angle: .2, acceleration: { x: 0, y: 0, z: 0 }, motionDt: .1 }
const free = () => ({ position: { x: 110, y: 20, z: -10 }, velocity: { x: 0, y: 40, z: 0 }, state: 'free', life: 10, radius: 3 })

it('uses curved depth and inverse rotated coordinates', () => {
  const uv = { x: .5, y: -.5, z: -.5 }
  const p = world(patch, uv)
  expect(local(patch, p).x).toBeCloseTo(uv.x)
  expect(local(patch, p).z).toBeCloseTo(uv.z)
  expect(normal(patch, { x: 0, y: -1, z: 0 }).y).toBeLessThan(0)
  expect(intersect(patch, { x: 100, y: 0, z: 80 }, { x: 100, y: 200, z: 80 })).toBeNull()
  expect(intersect(patch, { x: 100, y: 0, z: 0 }, { x: 100, y: 200, z: 0 })).not.toBeNull()
})
it('falls, attaches, slides and eventually detaches under gravity', () => {
  let drops = [free()]
  let attached = false
  let detached = false
  let firstY
  let slid = false
  for (let i = 0; i < 900; i++) {
    drops = stepDrops(drops, [patch], 1 / 120)
    const d = drops[0]
    if (!d) break
    if (d.state === 'attached') {
      attached = true
      firstY ??= d.position.y
      if (d.position.y > firstY + 5) slid = true
    } else if (attached) detached = true
  }
  expect({ attached, slid, detached }).toEqual({ attached: true, slid: true, detached: true })
})
it('mask rejection prevents contact outside the actual person', () => {
  let drops = [free()]
  for (let i = 0; i < 90; i++) drops = stepDrops(drops, [patch], 1 / 120, () => false)
  expect(drops[0].state).toBe('free')
})
it('acceleration ejects attached drops and creates splash particles', () => {
  const moving = { ...patch, center: { x: 120, y: 100, z: 0 }, previous: patch, acceleration: { x: 1600, y: 0, z: 0 } }
  const drop = { ...free(), state: 'attached', patch: 'head', uv: { x: 0, y: -1, z: 0 }, age: .3,
    velocity: { x: 0, y: 0, z: 0 } }
  const result = stepDrops([drop], [moving], 1 / 120)
  expect(result[0].state).toBe('free')
  expect(result[0].velocity.x).toBeGreaterThan(100)
  expect(result.filter(d => d.splash)).toHaveLength(3)
})
it('missing surface clears attached drops', () => {
  expect(stepDrops([{ ...free(), state: 'attached', patch: 'head' }], [], .01)).toHaveLength(0)
})
it('pose and segmentation build head, shoulders and torso with consistent crop and mirror', () => {
  const pose = Array.from({ length: 33 }, () => ({ x: .5, y: .3, z: 0, visibility: 1 }))
  pose[11] = { x: .7, y: .5, z: 0, visibility: 1 }
  pose[12] = { x: .3, y: .5, z: .1, visibility: 1 }
  pose[23] = { x: .65, y: .9, z: 0, visibility: 1 }
  pose[24] = { x: .35, y: .9, z: 0, visibility: 1 }
  const mask = new Uint8Array(400)
  for (let y = 3; y < 7; y++) for (let x = 6; x < 14; x++) mask[y * 20 + x] = 1
  for (let y = 10; y < 20; y++) for (let x = 2; x < 18; x++) mask[y * 20 + x] = 4
  const frame = { pose, mask, maskWidth: 20, maskHeight: 20, videoWidth: 200, videoHeight: 200, time: 100 }
  const patches = buildSurface(frame, 200, 200)
  expect(patches.map(p => p.id)).toEqual(['head', 'left-shoulder', 'right-shoulder', 'torso'])
  expect(patches[1].center.x).toBeGreaterThan(40)
  expect(patches[1].center.x).toBeLessThan(80)
  expect(patches[1].radius.y).toBeLessThanOrEqual(8)
  expect(patches[3].center.y).toBeCloseTo(140)
  expect(maskAt(frame, 200, 200, { x: 100, y: 50 })).toBe(true)
  expect(maskAt(frame, 200, 200, { x: 5, y: 5 })).toBe(false)
  pose[11].visibility = 0
  expect(buildSurface(frame, 200, 200).map(p => p.id)).toEqual(['head'])
  // The same crown remains usable as the subject grows beyond the shoulder framing.
  for (let y = 1; y < 14; y++) for (let x = 4; x < 16; x++) mask[y * 20 + x] = 1
  expect(buildSurface(frame, 200, 200).map(p => p.id)).toEqual(['head'])
  mask.fill(1, 4, 16)
  expect(buildSurface(frame, 200, 200)).toHaveLength(0)
})
it('rotational acceleration can throw a drop even without center translation', () => {
  const stationary = { ...patch, angle: 0 }
  const rotated = { ...patch, angle: .4, previous: stationary, angularVelocity: 4, angularAcceleration: 30 }
  const drop = { ...free(), state: 'attached', patch: 'head', uv: { x: 0, y: -1, z: 0 }, age: .3,
    velocity: { x: 0, y: 0, z: 0 } }
  const result = stepDrops([drop], [rotated], 1 / 120)
  expect(result[0].state).toBe('free')
  expect(result.some(d => d.splash)).toBe(true)
})

it('shoulder impacts produce one gentle splash and slide outward before detaching', () => {
  for (const side of [-1, 1]) {
    const shoulder = { ...patch, id: side < 0 ? 'left-shoulder' : 'right-shoulder',
      radius: { x: 40, y: 18, z: 22 }, angle: side * .2 }
    let drops = [{ ...free(), position: { x: 100, y: 72, z: 0 }, velocity: { x: 0, y: 160, z: 0 } }]
    let splash
    let contact
    let detached
    for (let step = 0; step < 300; step++) {
      drops = stepDrops(drops, [shoulder], 1 / 120)
      if (drops.length > 1) {
        expect(drops).toHaveLength(2)
        splash ??= { ...drops[1].velocity, life: drops[1].life }
      }
      if (drops[0]?.state === 'attached') contact ??= { ...drops[0].position }
      else if (contact && drops[0]) { detached = drops[0]; break }
    }
    expect(splash.life).toBeLessThanOrEqual(.32)
    expect(Math.abs(splash.y)).toBeLessThan(30)
    expect(detached.position.x * side).toBeGreaterThan(contact.x * side + 10)
    expect(detached.position.y).toBeGreaterThan(contact.y)
    expect(detached.fade).toBeGreaterThan(0)
  }
})

it('carries an attached shoulder drop with a lifted and tilted surface', () => {
  const shoulder = { ...patch, id: 'right-shoulder' }
  const uv = { x: .3, y: -Math.sqrt(.91), z: 0 }
  const raised = { ...shoulder, center: { ...shoulder.center, y: 81 }, angle: -.22, previous: shoulder }
  const drop = { ...free(), state: 'attached', patch: shoulder.id, uv, age: .05,
    velocity: { x: 0, y: 0, z: 0 }, position: world(shoulder, uv) }
  const [next] = stepDrops([drop], [raised], 1 / 120)
  expect(next.state).toBe('attached')
  expect(next.position.y).toBeLessThan(world(shoulder, uv).y - 10)
  expect(next.position.y).toBeCloseTo(world(raised, next.uv).y)
})

it('detects a fast drop whose swept path crosses the entire crown', () => {
  const drop = { ...free(), velocity: { x: 0, y: 25_000, z: 0 } }
  const [result] = stepDrops([drop], [patch], 1 / 120)
  expect(result.state).toBe('attached')
  expect(result.patch).toBe('head')
})

it('sweeps the segmented crown when the round shell misses visible hair', () => {
  const head = { ...patch, velocity: { x: 0, y: 0, z: 0 },
    crown: { x: 35, step: 5, values: Float32Array.from([46, 45, 44]) } }
  const drop = { ...free(), position: { x: 42, y: 0, z: 0 }, velocity: { x: 0, y: 25_000, z: 0 } }
  const events = []
  const result = stepDrops([drop], [head], 1 / 120, undefined, event => events.push(event))
  expect(events[0]).toMatchObject({ position: { x: 42, y: 45 }, responded: true, penetrating: false })
  expect(result[0].velocity.y).toBeLessThan(0)
  expect(result.filter(item => item.splash)).toHaveLength(2)
})

it('calibrates only supported hair slopes and bounds correction under zoom', async () => {
  const { calibrateCrown } = await import('../src/surface/crown-calibration.js')
  const values = Float32Array.of(70, 67, 64, 61, 58, 55, 52, 49, 46)
  const boundary = { x: 0, step: 3, values }
  const raw = values.slice()
  const first = calibrateCrown(boundary, raw, { left: 0, right: 200 }, 2)
  expect(first.values[4]).toBeLessThan(raw[4])
  expect(raw[4] - first.values[4]).toBeLessThanOrEqual(9)
  expect(boundary.values[4]).toBe(raw[4])
  raw[7] = NaN
  const unsupported = calibrateCrown(boundary, raw, { left: 0, right: 200 }, 2, first, 100)
  expect(unsupported.values[4]).toBe(values[4])
  const flat = new Float32Array(9).fill(60)
  expect(calibrateCrown({ ...boundary, values: flat }, flat, { left: 0, right: 200 }, 2).values).toEqual(flat)
})
