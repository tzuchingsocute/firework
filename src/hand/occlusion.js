import { local } from '../surface/physics.js'

export function shoulderOcclusion(palms, shoulders, depth) {
  const relations = []
  for (const palm of palms) {
    const tip = palm.wrist ?? palm.center
    const wrists = (depth?.wrists ?? []).filter(wrist => wrist.visibility > .7 &&
      Math.hypot(tip.x - wrist.x, tip.y - wrist.y) <= Math.max(10, palm.radius.x * .65))
    wrists.sort((a,b) => Math.hypot(tip.x-a.x,tip.y-a.y) - Math.hypot(tip.x-b.x,tip.y-b.y))
    const wrist = wrists.length === 1 ? wrists[0] : undefined
    for (const shoulder of shoulders) {
      if (Math.hypot(palm.center.x - shoulder.center.x, palm.center.y - shoulder.center.y) >
        Math.max(palm.radius.x,palm.radius.y) + Math.max(shoulder.radius.x,shoulder.radius.y)) continue
      const joint = depth?.shoulders?.[shoulder.id]
      // Pose wrist and shoulder share one coordinate system. Hand Landmarker Z is not used as shared depth.
      const synchronized = !Number.isFinite(depth?.time) || !Number.isFinite(palm.captureTime) ||
        Math.abs(depth.time - palm.captureTime) <= 180
      const separation = synchronized && wrist && joint?.visibility > .7 ? joint.z - wrist.z : NaN
      const order = separation > .09 ? 'FRONT' : separation < -.09 ? 'BEHIND' : 'UNCERTAIN'
      const confidence = order === 'UNCERTAIN' ? 'LOW' : 'MEDIUM'
      relations.push({ palm, shoulder, order, confidence, opacity: order === 'FRONT' ? 0 : order === 'BEHIND' ? 1 : .35 })
    }
  }
  return relations
}

export function obscuringPalm(relations, origin, position, padding) {
  return relations.filter(relation => relation.shoulder.id === origin && relation.opacity < 1 &&
    Math.hypot(relation.palm.center.x-position.x, relation.palm.center.y-position.y) <=
      Math.max(relation.palm.radius.x,relation.palm.radius.y) + padding)
    .sort((a,b) => a.opacity-b.opacity)[0]
}

export function overlapsAt(relation, point) {
  return [relation.palm, relation.shoulder].every(patch => {
    const mapped = local(patch, { ...point, z: patch.center.z })
    return mapped.x ** 2 + mapped.y ** 2 <= 1
  })
}

export function paintShoulderEffect(ctx, outline, opacity, width, height, paint) {
  const outside = new Path2D()
  outside.rect(0, 0, width, height)
  outside.addPath(outline)
  ctx.save()
  ctx.clip(outside, 'evenodd')
  paint(1)
  ctx.restore()
  if (opacity > 0) {
    ctx.save()
    ctx.clip(outline)
    paint(opacity)
    ctx.restore()
  }
}
