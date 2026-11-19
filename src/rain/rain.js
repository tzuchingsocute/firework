import approvedPreset from './luminous-rain.json' with { type: 'json' }

export const width = 414
export const height = 896

export const approvedPresetName = 'Luminous Rain — Approved Preset'
export const defaults = Object.freeze(approvedPreset)
export const previousMotion = { speed: .273, variation: .55, legacyMotion: true }
const previousSpeed = 245
const limit = 1200

export function fallingSpeed(params, visibleHeight) {
  return params.legacyMotion ? params.speed / previousMotion.speed * previousSpeed : params.speed * visibleHeight
}

export function createRain(random = Math.random) {
  const drops = []
  const pool = []
  let strands
  let slots = []
  let elapsed
  let serial = 0
  function reset() {
    pool.push(...drops)
    drops.length = 0
    elapsed = 0
    slots = []
    strands = Array.from({ length: 30 }, () => ({
      jitter: random(), birth: random() * .12,
      depth: random(), speed: random() * 2 - 1, width: 2 + random() * 8,
      rhythm: random() * 6, length: random() * 2 - 1, credit: random(),
    }))
  }
  reset()
  function advance(dt, params, onAdvance, bounds = { x: 0, y: 0, width, height }, emission = 1) {
    if (!bounds.width || !bounds.height) return
    if (slots.length !== params.strands) {
      slots = Array.from({ length: params.strands }, (_, index) => index)
      // Shuffle startup order so coverage grows across the frame instead of sweeping from left to right.
      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[slots[i], slots[j]] = [slots[j], slots[i]]
      }
    }
    const baseSpeed = fallingSpeed(params, bounds.height)
    // Arrival rate is proportional to speed so slower transit does not thicken the curtain.
    const densityScale = params.legacyMotion ? 1 : baseSpeed / (previousSpeed * .972)
    if (emission > 0) elapsed += dt
    for (let index = 0; emission > 0 && index < params.strands; index++) {
      const strand = strands[index]
      const age = elapsed - params.buildup * (strand.birth + index / params.strands * .86)
      if (age <= 0) continue
      const ramp = Math.min(1, age / (.2 + params.buildup * .19))
      const pulse = .26 + .74 * (.5 + .5 * Math.sin(age * 1.7 + strand.rhythm)) ** 2
      strand.credit += dt * emission * densityScale * params.density / params.strands * ramp * pulse * (.8 + strand.depth * .75)
      while (strand.credit >= 1 && drops.length < limit) {
        strand.credit--
        const drop = pool.pop() ?? {}
        drop.id = ++serial
        drop.x = bounds.x + Math.max(0, Math.min(bounds.width, (slots[index] + .22 + strand.jitter * .56) / slots.length * bounds.width + (random() - random()) * strand.width))
        drop.y = bounds.y - 1 - random() * 9
        drop.age = 0
        drop.depth = strand.depth
        drop.size = .48 + random() * .82
        drop.speedFactor = strand.speed * .72 + (random() - .5) * .56
        drop.current = (random() - .5) * .85
        drop.phase = random() * Math.PI * 2
        drop.tail = .45 + random() * .85
        drop.reach = strand.length
        drop.brightness = .42 + random() * .56
        drop.vx = 0
        drop.vy = 0
        drop.life = 1
        drop.newborn = true
        drop.response = undefined
        drops.push(drop)
      }
      strand.credit = Math.min(strand.credit, 1)
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i]
      drop.age += dt
      drop.vx = params.drift * (drop.current + Math.sin(drop.age * 1.2 + drop.phase) * .32)
      const previousSizeFactor = .87 + .28 * (1 - drop.size / 1.4)
      const sizeFactor = params.legacyMotion ? previousSizeFactor : .97 + .06 * (1 - drop.size / 1.4)
      drop.vy = baseSpeed * (1 + params.variation * drop.speedFactor) * sizeFactor
      drop.trailSpeed = params.legacyMotion ? drop.vy
        : previousSpeed * (1 + previousMotion.variation * drop.speedFactor) * previousSizeFactor
      drop.x += drop.vx * dt
      drop.y += drop.vy * dt
      const end = bounds.y + bounds.height * (.91 + params.lengthVariation * (drop.reach * .35 - .065))
      drop.life = Math.max(0, Math.min(1, (end - drop.y) / Math.min(85, bounds.height * .2)))
      // Future collision consumers can read the mutable position, velocity and lifetime per step.
      const keep = onAdvance?.(drop, dt)
      drop.newborn = false
      if (keep === false || drop.life === 0 || drop.y > bounds.y + bounds.height + 100) {
        drops[i] = drops.at(-1)
        pool.push(drop)
        drops.pop()
      }
    }
  }
  return { drops, reset, advance }
}
