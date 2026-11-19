import { projectPoints, videoGeometry } from '../projection.js'

const fingers = [[1,2,3,4], [5,6,7,8], [9,10,11,12], [13,14,15,16], [17,18,19,20]]
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const zero = { x: 0, y: 0, z: 0 }

export function handGeometry(detections, viewport, previous, time) {
  const { width, height, videoWidth, videoHeight, fit } = viewport
  const hands = new Map()
  const image = videoGeometry(width, height, videoWidth, videoHeight, fit)
  const visible = point => point.x >= Math.max(0, image.x) && point.x <= Math.min(width, image.x + image.imageWidth)
    && point.y >= Math.max(0, image.y) && point.y <= Math.min(height, image.y + image.imageHeight)
  const [first, second] = detections
  if (detections.length === 2 && first.side !== second.side &&
    first.landmarks[0] && second.landmarks[0]) {
    const a = previous?.hands.get(first.side)?.points[0]
    const b = previous?.hands.get(second.side)?.points[0]
    if (a && b && distance(a, b) > 20) {
      const [p, q] = projectPoints([first.landmarks[0], second.landmarks[0]], width, height, videoWidth, videoHeight, fit)
      if (distance(a, p) + distance(b, q) > distance(a, q) + distance(b, p) + 30) {
        detections = [{ ...first, side: second.side }, { ...second, side: first.side }]
      }
    }
  }
  for (const detection of detections) {
    const { side, score, landmarks } = detection
    if (!['Left', 'Right'].includes(side) || !Number.isFinite(score) || score < .55 || landmarks.length !== 21 ||
      landmarks.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)) || (hands.get(side)?.score ?? 0) >= score) continue
    const projected = projectPoints(landmarks, width, height, videoWidth, videoHeight, fit)
    const old = previous?.hands.get(side)
    const dt = old ? (time - previous.time) / 1000 : 0
    const tracked = dt > 0 && dt < .25 && distance(old.points[0], projected[0]) < Math.max(width, height) * .3
    const points = tracked ? projected.map((p, i) => {
      const before = old.points[i]
      const alpha = 1 - Math.exp(-dt / (distance(p, before) / dt > 350 ? .018 : .048))
      return { x: before.x + (p.x - before.x) * alpha, y: before.y + (p.y - before.y) * alpha }
    }) : projected
    const [wrist, index, middle, pinky] = [points[0], points[5], points[9], points[17]]
    const palmWidth = distance(index, pinky)
    const palmLength = distance(wrist, middle)
    const center = { x: (wrist.x + middle.x) / 2, y: (wrist.y + middle.y) / 2, z: 0 }
    const palmPoints = [wrist, ...[5, 9, 13, 17].map(i => points[i])]
    if (!palmPoints.some(visible)) continue
    const foreshortened = palmLength < palmWidth * .28
    const palmAngle = foreshortened ? Math.atan2(pinky.y - index.y, pinky.x - index.x)
      : Math.atan2(middle.y - wrist.y, middle.x - wrist.x) - Math.PI / 2
    const palmUsable = palmWidth >= 8 && (foreshortened || palmLength >= 8 && palmWidth / palmLength > .24)
    let palmCenter = center
    let halfWidth = palmWidth * .64
    let halfLength = palmLength * .57
    if (foreshortened) {
      const c = Math.cos(palmAngle)
      const s = Math.sin(palmAngle)
      const across = palmPoints.map(p => c * p.x + s * p.y)
      const depth = palmPoints.map(p => -s * p.x + c * p.y)
      const x = (Math.min(...across) + Math.max(...across)) / 2
      const y = (Math.min(...depth) + Math.max(...depth)) / 2
      palmCenter = { x: c * x - s * y, y: s * x + c * y, z: 0 }
      halfWidth = (Math.max(...across) - Math.min(...across)) * .54
      // A narrow scale-relative silhouette remains usable when the palm points nearly overlap in profile.
      halfLength = Math.max((Math.max(...depth) - Math.min(...depth)) * .55, palmWidth * .055)
    }
    const patches = []
    function add(id, kind, center, radius, angle) {
      const prior = tracked && old.patches.find(patch => patch.id === id)
      const velocity = prior ? { x: (center.x - prior.center.x) / dt, y: (center.y - prior.center.y) / dt, z: 0 } : zero
      const acceleration = prior ? { x: (velocity.x - prior.velocity.x) / dt, y: (velocity.y - prior.velocity.y) / dt, z: 0 } : zero
      patches.push({ id, hand: kind, center, radius, angle, velocity, acceleration, previous: prior ? { center: prior.center, radius: prior.radius, angle: prior.angle } : undefined, motionDt: dt })
    }
    if (palmUsable) add(`hand-${side}-palm`, 'palm', palmCenter,
      { x: halfWidth, y: halfLength, z: Math.max(3, palmWidth * .18) }, palmAngle)
    if (palmUsable) patches.at(-1).wrist = wrist
    if (palmWidth >= 8 && palmLength >= 8) {
      for (const chain of fingers) {
        for (let i = 1; i < chain.length; i++) {
          const a = points[chain[i - 1]]
          const b = points[chain[i]]
          const length = distance(a, b)
          if (length < 2) continue
          const thickness = Math.min(palmWidth * (i === 3 ? .078 : .105), length * .45)
          add(`hand-${side}-finger-${chain[i]}`, 'finger', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 0 },
            { x: length / 2 + thickness * .6, y: thickness, z: thickness }, Math.atan2(b.y - a.y, b.x - a.x))
        }
      }
    }
    hands.set(side, { side, score, points, patches })
  }
  return { hands, time }
}
