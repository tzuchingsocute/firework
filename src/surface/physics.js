export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
export const mul = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s })
export const sub = (a, b) => add(a, mul(b, -1))
export const length = v => Math.hypot(v.x, v.y, v.z)
export const unit = v => mul(v, 1 / (length(v) || 1))

export function local(patch, position) {
  const p = sub(position, patch.center)
  const c = Math.cos(patch.angle)
  const s = Math.sin(patch.angle)
  return { x: (c * p.x + s * p.y) / patch.radius.x,
    y: (-s * p.x + c * p.y) / patch.radius.y, z: p.z / patch.radius.z }
}

export function world(patch, uv) {
  const x = uv.x * patch.radius.x
  const y = uv.y * patch.radius.y
  return add(patch.center, { x: Math.cos(patch.angle) * x - Math.sin(patch.angle) * y,
    y: Math.sin(patch.angle) * x + Math.cos(patch.angle) * y, z: uv.z * patch.radius.z })
}

export function normal(patch, uv) {
  const x = uv.x / patch.radius.x
  const y = uv.y / patch.radius.y
  return unit({ x: Math.cos(patch.angle) * x - Math.sin(patch.angle) * y,
    y: Math.sin(patch.angle) * x + Math.cos(patch.angle) * y, z: uv.z / patch.radius.z })
}

export function intersect(patch, from, to) {
  const a = local(patch, from)
  const b = sub(local(patch, to), a)
  const aa = dot(b, b)
  const bb = 2 * dot(a, b)
  const cc = dot(a, a) - 1
  if (cc <= 0) return { t: 0, uv: unit(a) }
  const discriminant = bb * bb - 4 * aa * cc
  if (aa < 1e-12 || discriminant < 0) return null
  const t = (-bb - Math.sqrt(discriminant)) / (2 * aa)
  return t >= 0 && t <= 1 ? { t, uv: unit(add(a, mul(b, t))) } : null
}

export function sampleMotion(patch, previous, uv, dt) {
  if (!previous || dt <= 0 || dt > .5) return { x: 0, y: 0, z: 0 }
  const velocity = mul(sub(world(patch, uv), world(previous, uv)), 1 / dt)
  return mul(velocity, Math.min(1, 1800 / (length(velocity) || 1)))
}

function shoulderSide(patch) {
  if (patch.id === 'left-shoulder') return -1
  if (patch.id === 'right-shoulder') return 1
  return 0
}

function sweepCrown(patch, from, to) {
  if (!patch.crown || to.y <= from.y) return null
  const { x, step, values } = patch.crown
  const travel = sub(to, from)
  const segments = Math.max(1, Math.ceil(Math.abs(travel.x) / step))
  for (let index = 0; index < segments; index++) {
    const column = Math.floor((from.x + travel.x * (index + .5) / segments - x) / step)
    const y = values[column]
    const t = (y - from.y) / travel.y
    if (!(t >= 0 && t <= 1)) continue
    const position = add(from, mul(travel, t))
    if (Math.floor((position.x - x) / step) !== column || Math.abs(position.z - patch.center.z) > patch.radius.z) continue
    const before = values[column - 1]
    const after = values[column + 1]
    const slope = Number.isFinite(before) && Number.isFinite(after) ? (after - before) / (2 * step) : 0
    return { t, position, normal: unit({ x: slope, y: -1, z: 0 }) }
  }
  return null
}

export function stepDrops(drops, patches, dt, valid = () => true, observe, faceSide = () => 0, inspectHead, options = {}) {
  const gravity = { x: 0, y: 280, z: 0 }
  const splashes = []
  for (const drop of drops) {
    drop.life -= dt
    drop.cooldown = Math.max(0, (drop.cooldown || 0) - dt)
    if (drop.state === 'attached') {
      const patch = patches.find(p => p.id === drop.patch)
      if (!patch) { drop.life = 0; continue }
      const p = world(patch, drop.uv)
      const n = normal(patch, drop.uv)
      const surfaceVelocity = sampleMotion(patch, patch.previous, drop.uv, patch.motionDt)
      const offset = sub(p, patch.center)
      const omega = patch.angularVelocity || 0
      const alpha = patch.angularAcceleration || 0
      const acceleration = add(patch.acceleration ?? { x: 0, y: 0, z: 0 }, {
        x: -alpha * offset.y - omega * omega * offset.x,
        y: alpha * offset.x - omega * omega * offset.y, z: 0,
      })
      const force = sub(gravity, mul(acceleration, .75))
      const side = drop.patch === 'head' ? faceSide(add(p, mul(drop.velocity, .055))) : 0
      const shoulder = shoulderSide(patch)
      const guided = side ? add(force, { x: side * 680, y: -180, z: 0 })
        : shoulder ? add(force, { x: shoulder * 105 * Math.cos(patch.angle),
          y: shoulder * 105 * Math.sin(patch.angle), z: 0 }) : force
      const tangent = sub(guided, mul(n, dot(guided, n)))
      drop.velocity = mul(add(drop.velocity, mul(tangent, dt)), Math.exp(-1.8 * dt))
      drop.velocity = sub(drop.velocity, mul(n, dot(drop.velocity, n)))
      const candidate = unit(local(patch, add(p, mul(drop.velocity, dt))))
      drop.uv = candidate
      drop.position = world(patch, candidate)
      drop.age += dt
      const shaken = !shoulder && drop.age > .08 && length(acceleration) > 900 && length(surfaceVelocity) > 110
      const unsupported = drop.age > .12 && (n.y > .45 || (!patch.hand && !valid(drop.position)) || (side && drop.age > .22))
      const shoulderEdge = shoulder && drop.age > .14 && candidate.x * shoulder > .85
      if (shaken || unsupported || shoulderEdge || drop.age > (patch.hand ? .5 : 6)) {
        drop.state = 'free'
        drop.cooldown = .18
        if (shoulder) {
          drop.life = Math.min(drop.life, .9)
          drop.fade = .35
        }
        drop.position = add(drop.position, mul(n, 4))
        drop.velocity = add(drop.velocity, add(surfaceVelocity, mul(n, shaken ? 150 : shoulder ? 8 : 25)))
        if (shaken) {
          for (let i = -1; i <= 1; i++) splashes.push({
            position: { ...drop.position }, velocity: add(drop.velocity, { x: i * 75, y: -50 - Math.abs(i) * 25, z: i * 30 }),
            state: 'free', life: .8, cooldown: .25, radius: 1.6, splash: true, hand: patch.hand, rainSource: drop.rainSource,
          })
        }
      }
      continue
    }
    const from = drop.position
    if (!options.kinematic) drop.velocity = add(drop.velocity, mul(gravity, dt))
    const to = add(from, mul(drop.velocity, dt))
    let nearest
    let crown
    let headCheck
    if (!drop.cooldown && !drop.splash && !drop.noFurtherImpact) {
      for (const patch of patches) {
        if (drop.skipPalmImpact && patch.hand === 'palm') continue
        let start = from
        let end = to
        let motion
        if (patch.hand) {
          // Monocular hand depth is approximate. Test the projected silhouette and retain earliest time of contact.
          const padding = Math.max(patch.radius.x, patch.radius.y)
          motion = mul(patch.velocity, dt)
          if (Math.min(from.x, to.x) > patch.center.x + padding + Math.abs(motion.x) ||
            Math.max(from.x, to.x) < patch.center.x - padding - Math.abs(motion.x) ||
            Math.min(from.y, to.y) > patch.center.y + padding + Math.abs(motion.y) ||
            Math.max(from.y, to.y) < patch.center.y - padding - Math.abs(motion.y)) {
            if (Math.abs(from.x - patch.center.x) < padding * 2 && Math.abs(from.y - patch.center.y) < padding * 2) {
              options.candidate?.(patch, 'outside-sweep')
            }
            continue
          }
          start = { x: from.x + motion.x, y: from.y + motion.y, z: patch.center.z }
          end = { ...to, z: patch.center.z }
        }
        let shell = intersect(patch, start, end)
        if (patch.hand === 'palm' && shell?.t === 0) {
          const travel = sub(end, start)
          if (length(travel) > 1e-6) {
            const outside = sub(start, mul(unit(travel), 2 * Math.max(patch.radius.x, patch.radius.y) + 1))
            const entry = intersect(patch, outside, start)
            if (entry) shell = { ...entry, t: 0 }
          }
        }
        const shellPoint = shell && world(patch, shell.uv)
        const shellPosition = shellPoint && motion ? sub(shellPoint, mul(motion, 1 - shell.t)) : shellPoint
        const shellAllowed = shellPosition && (patch.hand ? options.handVisible?.(shellPosition) ?? true : valid(shellPosition))
        const cap = sweepCrown(patch, from, to)
        const useCap = cap && (!shellAllowed || cap.t < shell.t)
        const hit = useCap ? cap : shellAllowed ? shell : null
        const position = useCap ? cap.position : shellPosition
        const n = useCap ? cap.normal : shell && normal(patch, shell.uv)
        if (inspectHead && position && patch.id === 'head' && drop.velocity.y > 0 && n.y < -.25) {
          headCheck = { id: drop.id, position, allowed: Boolean(hit), startedInside: hit?.t === 0 }
        }
        options.candidate?.(patch, hit ? 'contact' : shell ? 'outside-visible-surface' : 'segment-missed', hit?.t, position)
        if (!hit) continue
        const impact = { ...hit, patch, position, normal: n, cap: Boolean(useCap) }
        if (observe && patch.id === 'head' && from.y < patch.center.y && drop.velocity.y > 0
          && n.y < -.25) crown = impact
        if (!nearest || hit.t < nearest.t || hit.t === nearest.t &&
          options.preferCoincidentPalm?.(patch, nearest.patch, position)) nearest = impact
      }
    }
    const deflection = options.deflect?.(from, to)
    if (deflection && (!nearest || deflection.t < nearest.t)) {
      drop.position = deflection.point
      drop.velocity = { x: drop.velocity.x * .3 + deflection.direction * (35 + 105 * deflection.strength),
        y: drop.velocity.y * (1 - .6 * deflection.strength), z: drop.velocity.z }
      drop.life = .48
      drop.noFurtherImpact = true
      options.onImpact?.(drop, drop.position, deflection.kind)
      continue
    }
    const incidentVelocity = drop.velocity
    const splashCountBefore = splashes.length
    const inspectDrop = inspectHead && !drop.splash && !drop.cooldown && incidentVelocity.y > 0
    if (crown && (!nearest || nearest.t >= crown.t)) observe({
      id: drop.id, position: crown.position, velocity: { ...drop.velocity },
      normal: crown.normal, responded: nearest?.patch === crown.patch,
      splash: nearest?.patch === crown.patch, penetrating: crown.t === 0,
    })
    if (nearest) {
      options.onImpact?.(drop, nearest.position, nearest.patch.id)
      const { patch, uv, normal: n, position } = nearest
      const surfaceVelocity = nearest.cap ? patch.velocity : sampleMotion(patch, patch.previous, uv, patch.motionDt)
      if (patch.id === 'head' && n.y < -.25) {
        for (const side of [-1, 1]) {
          splashes.push({ position: add(position, mul(n, 4)),
            velocity: add(surfaceVelocity, add(mul(n, 95), { x: side * 95, y: -45, z: 0 })),
            state: 'free', life: .75, radius: 1.6, splash: true })
        }
      }
      const shoulder = shoulderSide(patch)
      if (shoulder && n.y < -.2) {
        splashes.push({
          position: add(world(patch, uv), mul(n, 2)),
          velocity: {
            x: shoulder * 26 + Math.max(-14, Math.min(14, surfaceVelocity.x * .25)),
            y: -22 + Math.max(-6, Math.min(12, surfaceVelocity.y * .25)),
            z: 0,
          },
          state: 'free', origin: patch.id, life: .32, fade: .18, radius: 1.25, splash: true,
        })
      }
      if (patch.hand) {
        const relative = sub(drop.velocity, surfaceVelocity)
        const lateral = unit(sub(relative, mul(n, dot(relative, n))))
        const strength = Math.min(100, 24 + Math.max(length(relative), options.handFeedbackSpeed ?? 0) * .15)
        const tangent = length(lateral) ? lateral : { x: -n.y, y: n.x, z: 0 }
        for (const side of patch.hand === 'palm' ? [-1, 1] : [1]) {
          splashes.push({ position: add(position, mul(n, 2)),
            velocity: add(mul(surfaceVelocity, .65), add(mul(tangent, strength * side * (patch.hand === 'finger' ? .38 : 1)), mul(n, 17))),
            life: patch.hand === 'finger' ? .2 : .36, radius: 1, splash: true, hand: patch.hand, state: 'free' })
        }
      }
      const relative = sub(drop.velocity, surfaceVelocity)
      if (patch.hand === 'finger') {
        drop.position = add(position, mul(n, 2))
        drop.velocity = add(surfaceVelocity, mul(sub(relative, mul(n, 1.15 * dot(relative, n))), .65))
        drop.cooldown = .15
      } else if (nearest.cap) {
        drop.position = add(position, mul(n, 2))
        drop.velocity = add(surfaceVelocity, mul(sub(relative, mul(n, 1.35 * dot(relative, n))), .55))
        drop.cooldown = .18
      } else {
        drop.state = 'attached'
        drop.patch = patch.id
        drop.origin = patch.id
        drop.uv = uv
        drop.age = 0
        drop.velocity = mul(sub(relative, mul(n, dot(relative, n))), .2)
        drop.position = position
      }
    } else drop.position = to
    const emittedSplashes = splashes.length - splashCountBefore
    if (inspectDrop) {
      inspectHead(drop.id, from, to, headCheck && { ...headCheck, result: !headCheck.allowed ? 'mask'
        : nearest?.patch.id === 'head' ? 'hit' : 'other-surface' }, nearest?.patch.id, incidentVelocity, nearest && {
        patch: nearest.patch.id, position: nearest.position, surface: nearest.cap ? 'segmented-crown' : 'ellipsoid',
        splashEmitted: emittedSplashes > 0, splashCount: emittedSplashes,
      })
    }
  }
  return [...drops.filter(d => d.life > 0), ...splashes].slice(0, options.limit ?? 80)
}
