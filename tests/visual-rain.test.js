import { expect, it } from 'vitest'
import { createRain, defaults, width } from '../src/rain/rain.js'

it('spawns inside the top edge, then builds a staggered flow with a bounded particle count', () => {
  let seed = 8
  const rain = createRain(() => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32))
  function advance(seconds) {
    for (let frame = 0; frame < seconds * 60; frame++) {
      rain.advance(1 / 60, defaults, drop => {
        if (drop.age <= 1 / 60) {
          expect(drop.x - drop.vx / 60).toBeGreaterThanOrEqual(0)
          expect(drop.x - drop.vx / 60).toBeLessThanOrEqual(width)
          expect(drop.y - drop.vy / 60).toBeLessThan(0)
        }
        expect(drop.vy).toBeGreaterThan(0)
      })
    }
  }
  advance(1)
  const early = rain.drops.length
  advance(7)
  expect(rain.drops.length).toBeGreaterThan(early * 3)
  expect(rain.drops.some(drop => drop.y > 600)).toBe(true)
  expect(rain.drops.length).toBeLessThanOrEqual(1200)
  rain.reset()
  expect(rain.drops).toHaveLength(0)
})

it('transfers a swept hit once and allows unaffected drops to continue', async () => {
  const { createInteraction } = await import('../src/rain/interaction.js')
  const bridge = createInteraction(() => false)
  const head = { id: 'head', center: { x: 200, y: 150, z: 0 }, radius: { x: 50, y: 40, z: 30 },
    angle: 0, velocity: { x: 0, y: 0, z: 0 } }
  const frame = { key: 'portrait', width, height: 896, stageTop: 0, stageHeight: 896, patches: [head], valid: () => true }
  bridge.begin(frame, .05)
  expect(bridge.advance({ id: 1, x: 200, y: 140, vx: 0, vy: 1000 }, .05)).toBe(false)
  expect(bridge.impacts.map(hit => hit.id)).toEqual([1])
  expect(bridge.droplets.find(drop => drop.id === 1).state).toBe('attached')
  expect(bridge.droplets.filter(drop => drop.splash)).toHaveLength(2)
  expect(bridge.advance({ id: 2, x: 20, y: 140, vx: 0, vy: 1000 }, .05)).toBeUndefined()
  for (let i = 0; i < 50; i++) bridge.begin({ ...frame, patches: [] }, .05)
  expect(bridge.impacts).toHaveLength(0)
  expect(bridge.droplets).toHaveLength(0)
  expect(bridge.advance({ id: 3, x: 200, y: 140, vx: 0, vy: 1000 }, .05)).toBeUndefined()
})

it('maps the landscape video offset and bounds simultaneous shoulder effects', async () => {
  const { createInteraction } = await import('../src/rain/interaction.js')
  const bridge = createInteraction(() => false)
  const shoulder = { id: 'left-shoulder', center: { x: 100, y: 80, z: 0 },
    radius: { x: 45, y: 25, z: 30 }, angle: 0, velocity: { x: 0, y: 0, z: 0 } }
  const frame = { key: 'landscape', width: 207, height: 448, stageTop: 125, stageHeight: 198,
    patches: [shoulder], valid: () => true }
  bridge.begin(frame, 0)
  for (let id = 1; id <= 240; id++) {
    expect(bridge.advance({ id, x: 200, y: 380, vx: 0, vy: 1200 }, .05)).toBe(false)
  }
  expect(bridge.impacts.every(hit => hit.surface === 'left-shoulder' && hit.y < 80)).toBe(true)
  expect(bridge.droplets.length).toBeLessThanOrEqual(160)
  expect(bridge.droplets.filter(drop => drop.id === 240)).toHaveLength(1)
  expect(bridge.droplets.filter(drop => drop.splash && drop.life > .32)).toHaveLength(0)
  bridge.begin({ ...frame, key: 'portrait' }, 0)
  expect(bridge.droplets).toHaveLength(0)
})

it('starts each new raindrop at the offset video window and keeps its original fall speed', () => {
  const rain = createRain(() => .5)
  const rect = { x: 72, y: 330, width: 270, height: 235 }
  const dt = 1 / 60
  let births = 0
  for (let i = 0; i < 300; i++) {
    rain.advance(dt, defaults, drop => {
      if (drop.age !== dt) return
      births++
      expect(drop.x).toBeGreaterThanOrEqual(rect.x)
      expect(drop.x).toBeLessThanOrEqual(rect.x + rect.width)
      expect(drop.y - drop.vy * dt).toBeCloseTo(rect.y - 5.5)
    }, rect)
  }
  expect(births).toBeGreaterThan(0)
})

it('fills every strand band even when the random source repeatedly chooses the same position', () => {
  const rain = createRain(() => .5)
  const bounds = { x: 50, y: 300, width: 310, height: 230 }
  const params = { ...defaults, buildup: .5 }
  const visited = new Set()
  const dt = 1 / 60
  for (let frame = 0; frame < 360; frame++) {
    rain.advance(dt, params, drop => {
      if (drop.age === dt) visited.add(Math.floor((drop.x - bounds.x) / bounds.width * params.strands))
    }, bounds)
  }
  expect(visited.size).toBe(params.strands)
})

it('moves at the same normalized speed across visible heights and frame cadences', async () => {
  const { fallingSpeed, previousMotion } = await import('../src/rain/rain.js')
  expect(fallingSpeed(defaults,896)).toBeCloseTo(188.16)
  expect(fallingSpeed(defaults,233)).toBeCloseTo(48.93)
  expect(fallingSpeed(previousMotion,233)).toBe(245)
  const samples = [24,30,60,120].map(fps => {
    const rain = createRain(() => .5)
    const bounds = {x:0,y:330,width:414,height:233}
    const dt = 1/fps
    const params = {...defaults,buildup:.5}
    for(let i=0;i<5*fps;i++) rain.advance(dt,params,undefined,bounds)
    const drop = rain.drops.find(point=>point.y<440)
    const start = drop.y
    const trail = drop.trailSpeed
    for(let i=0;i<fps;i++) rain.advance(dt,params,undefined,bounds,0)
    expect(drop.trailSpeed).toBeCloseTo(trail)
    return drop.y-start
  })
  expect(Math.max(...samples)-Math.min(...samples)).toBeLessThan(.01)
})

it('contacts the same palm at old and normalized speeds, with visible slow-rain feedback', async () => {
  const { createInteraction } = await import('../src/rain/interaction.js')
  for (const speed of [245, 165.76, 43.105]) {
    const bridge = createInteraction(() => false)
    const palm = { id: 'left-palm', hand: 'palm', center: { x: 200, y: 420, z: 0 },
      radius: { x: 30, y: 8, z: 12 }, angle: 0, velocity: { x: 0, y: 0, z: 0 } }
    bridge.begin({ key: 'test', width: 414, height: 896, stageTop: 0, stageHeight: 896,
      patches: [palm], valid: () => true }, 0)
    expect(bridge.advance({ id: 1, x: 200, y: 412.25, vx: 0, vy: speed }, 1 / 60)).toBe(false)
    expect(bridge.impacts).toHaveLength(1)
    expect(bridge.impacts[0].y).toBeCloseTo(412)
    expect(bridge.droplets.filter(drop => drop.splash)).toHaveLength(2)
    expect(bridge.droplets.filter(drop => drop.splash).every(drop => Math.abs(drop.velocity.x) >= 60)).toBe(true)
  }
})

it('retires a swept front drop and never restores it below the chin or after face loss', async () => {
  const { keepVisible } = await import('../src/rain/visibility.js')
  const face = { margin: 2, points: [{x:30,y:50},{x:90,y:50},{x:90,y:130},{x:30,y:130}] }
  const drop = {}
  expect(keepVisible(drop, face, {x:60,y:20}, {x:60,y:42})).toBe(true)
  expect(drop.visibility).toBeCloseTo(.5)
  expect(keepVisible(drop, face, {x:60,y:42}, {x:60,y:142})).toBe(false)
  expect(keepVisible(drop, null, {x:60,y:142}, {x:60,y:180})).toBe(false)
  expect(keepVisible({}, face, {x:5,y:20}, {x:5,y:180})).toBe(true)
})
