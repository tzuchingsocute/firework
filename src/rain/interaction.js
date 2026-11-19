import { overlapsAt } from '../hand/occlusion.js'
import { adaptiveContact } from './adaptive.js'
import { stepDrops } from '../surface/physics.js'
import { width, height } from './rain.js'

const maxEffects = 160
const step = 1 / 120

export function createInteraction(insideFace, onImpact) {
  let droplets = []
  let impacts = []
  let frame
  let bodyPatches = []
  let remainder = 0
  let serial = 0

  function reset() {
    droplets = []
    impacts = []
    remainder = 0
  }

  function begin(next, dt) {
    if (frame?.key !== next.key) reset()
    frame = next
    bodyPatches = frame.patches.filter(candidate => !candidate.hand)
    impacts = impacts.filter(hit => (hit.life -= dt) > 0)
    remainder += dt
    const face = frame.face
    const guide = face ? point => insideFace(face.points, point) ? Math.sign(point.x - face.center) || 1 : 0 : undefined
    while (remainder >= step) {
      droplets = stepDrops(droplets, frame.patches, step, frame.valid, undefined, guide, undefined, { limit: maxEffects })
      droplets.forEach(drop => { drop.id ??= --serial })
      remainder -= step
    }
  }

  function advance(drop, dt) {
    if ((!frame.patches.length && !frame.adaptive) || dt <= 0 || !frame.width || !frame.height) return
    const sx = frame.width / width
    const sy = frame.height / height
    const x = (drop.x - drop.vx * dt) * sx
    const y = (drop.y - drop.vy * dt) * sy - frame.stageTop
    if (y + drop.vy * dt * sy < 0 || y > frame.stageHeight) return
    const patch = bodyPatches.reduce((nearest, candidate) =>
      !nearest || Math.abs(candidate.center.x - x) < Math.abs(nearest.center.x - x) ? candidate : nearest, null)
    const head = frame.patches.find(item => item.crown && Number.isFinite(
      item.crown.values[Math.floor((x - item.crown.x) / item.crown.step)]))
    const depth = head ?? patch
    const proxy = {
      id: drop.id, position: { x, y, z: depth ? depth.center.z - depth.radius.z * .45 : 0 },
      velocity: { x: drop.vx * sx, y: drop.vy * sy, z: 0 },
      life: 1.5, age: 0, state: 'free', radius: 1.15, cooldown: 0,
    }
    let hit
    const candidates = frame.inspect ? [] : null
    const visible = frame.visibleBounds
    const handVisible = visible ? point => {
      const px = point.x / sx
      const py = (point.y + frame.stageTop) / sy
      return px >= visible.x && px <= visible.x + visible.width && py >= visible.y && py <= visible.y + visible.height
    } : undefined
    const result = stepDrops([proxy], frame.patches, dt, frame.valid, undefined, undefined, undefined, {
      kinematic: true, handVisible,
      // Keep slow visual rain readable on contact without changing its sweep or body response.
      handFeedbackSpeed: 245 * sy,
      preferCoincidentPalm: (candidate, current, point) => candidate.hand === 'palm' &&
        frame.occlusion?.some(relation => relation.order === 'FRONT' && relation.palm.id === candidate.id &&
          relation.shoulder.id === current.id && (overlapsAt(relation, point) || overlapsAt(relation, { x, y }))) || false,
      candidate: candidates ? (patch, reason, t, position) => {
        if (patch.hand || patch.id.includes('shoulder')) {
          candidates.push({ surface: patch.id, type: patch.hand ? patch.hand.toUpperCase() : 'SHOULDER', reason, t,
            timeMs: t === undefined ? undefined : dt * t * 1000, position })
        }
      } : undefined,
      deflect: frame.adaptive ? (from, to) => adaptiveContact(frame.adaptive, from, to,
        point => frame.face && insideFace(frame.face.points, point)) : undefined,
      onImpact: (_, position, surface) => { hit = { ...position, surface, life: .65, id: drop.id, response: drop.response } },
    })
    if (candidates?.some(candidate => candidate.type !== 'SHOULDER') &&
      (hit || candidates.some(candidate => candidate.type !== 'SHOULDER' && candidate.reason !== 'contact'))) {
      frame.inspect({ id:drop.id, from:{x,y}, to:{x:drop.x*sx,y:drop.y*sy-frame.stageTop}, candidates, selected:hit?.surface ?? null })
    }
    if (!hit) return
    const visibleHit = !visible || handVisible(hit)
    onImpact?.(hit)
    impacts.push(hit)
    if (impacts.length > 80) impacts.shift()
    if (!visibleHit) return false
    if (hit.surface.endsWith('-palm')) proxy.noFurtherImpact = true
    if (hit.surface.includes('shoulder')) proxy.skipPalmImpact = true
    for (const child of result) {
      child.id ??= --serial
      child.rainSource = hit.surface
      if (hit.surface === 'head' && frame.adaptive) child.effectWeight = Math.max(.55, frame.adaptive.weights.crown)
      droplets.push(child)
    }
    if (droplets.length > maxEffects) droplets.splice(0, droplets.length - maxEffects)
    return false
  }

  return { begin, advance, reset, get droplets() { return droplets }, get impacts() { return impacts } }
}
