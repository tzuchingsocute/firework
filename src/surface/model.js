import { calibrateCrown } from './crown-calibration.js'
import { projectPoints, videoGeometry } from '../projection.js'
import { length, mul, sub } from './physics.js'

export function buildSurface(frame, width, height, previous, diagnostics) {
  const pose = frame.pose
  const patches = []
  const patch = (id, center, radius, angle) => ({ id, center, radius, angle })
  const geometry = videoGeometry(width, height, frame.videoWidth, frame.videoHeight, frame.mode)
  const scale = geometry.imageWidth
  const points = pose?.length ? projectPoints(pose, width, height, frame.videoWidth, frame.videoHeight, frame.mode) : []
  const shoulderWidth = points.length && Math.hypot(points[11].x - points[12].x, points[11].y - points[12].y)
  const shouldersVisible = shoulderWidth >= 12 && [11, 12].every(i => pose[i].visibility > .5)
  const shoulderZ = shouldersVisible ? (pose[11].z + pose[12].z) * scale / 2 : 0
  const rawAngle = shouldersVisible ? Math.atan2(points[12].y - points[11].y, points[12].x - points[11].x) : 0
  const angle = Math.atan(Math.tan(rawAngle))
  const poseNose = pose?.[0]?.visibility > .5 ? pose[0] : undefined
  const anchor = poseNose ?? frame.faceAnchor?.nose
  const [nose] = anchor ? projectPoints([anchor], width, height, frame.videoWidth, frame.videoHeight, frame.mode) : []
  const head = findHead(frame, geometry, nose, width, height)
  if (head.active) {
    head.rawCrown = head.crown
    const prior = previous?.patches.find(patch => patch.id === 'head')?.crown
    head.crown = calibrateCrown(head.rawCrown, head.hairBoundary.values, head.bounds,
      geometry.imageHeight / frame.videoHeight, prior, frame.time - previous?.time)
  }
  if (diagnostics) Object.assign(diagnostics, head)
  if (head.active) {
    const { left, right, top } = head.bounds
    const bottom = Math.min(head.bounds.bottom, Math.max(nose.y + 8,
      shouldersVisible ? (points[11].y + points[12].y) / 2 : 2 * nose.y - top))
    const ears = [7, 8].every(i => pose?.[i]?.visibility > .5) ? [points[7], points[8]] : undefined
    const eyes = frame.faceAnchor && projectPoints(frame.faceAnchor.eyes, width, height, frame.videoWidth, frame.videoHeight, frame.mode)
    const [first, second] = ears ?? eyes ?? []
    const roll = first ? Math.atan(Math.tan(Math.atan2(second.y - first.y, second.x - first.x))) : 0
    patches.push({ ...patch('head', { x: (left + right) / 2, y: (top + bottom) / 2,
      z: (anchor.z * scale - shoulderZ) * .35 },
    { x: (right - left) / 2, y: (bottom - top) / 2, z: (shouldersVisible ? shoulderWidth : right - left) * .22 }, roll), crown: head.crown })
  }
  if (shouldersVisible) {
    for (const [index, id] of [[11, 'left-shoulder'], [12, 'right-shoulder']]) {
      const shoulder = fitShoulder(frame, geometry, points[index], points[index === 11 ? 12 : 11],
        shoulderWidth, width, height)
      if (shoulder) patches.push(patch(id, { ...shoulder.center, z: (pose[index].z * scale - shoulderZ) * .35 },
        { x: shoulder.radius, y: shoulder.thickness, z: shoulderWidth * .18 }, shoulder.angle))
    }
    const shoulderCenter = { x: (points[11].x + points[12].x) / 2, y: (points[11].y + points[12].y) / 2 }
    const hipsVisible = pose[23].visibility > .5 && pose[24].visibility > .5
    const hip = hipsVisible ? { x: (points[23].x + points[24].x) / 2, y: (points[23].y + points[24].y) / 2 }
      : { x: shoulderCenter.x - Math.sin(angle) * shoulderWidth, y: shoulderCenter.y + Math.cos(angle) * shoulderWidth }
    patches.push(patch('torso', { x: (shoulderCenter.x + hip.x) / 2, y: (shoulderCenter.y + hip.y) / 2, z: 0 },
      { x: shoulderWidth * .48, y: Math.max(20, Math.hypot(hip.x - shoulderCenter.x, hip.y - shoulderCenter.y) * .63), z: shoulderWidth * .22 },
      Math.atan2(hip.y - shoulderCenter.y, hip.x - shoulderCenter.x) - Math.PI / 2))
  }
  const dt = previous ? (frame.time - previous.time) / 1000 : 0
  return patches.map(p => {
    const old = previous?.patches.find(item => item.id === p.id)
    let velocity = { x: 0, y: 0, z: 0 }
    let acceleration = velocity
    let angularVelocity = 0
    let angularAcceleration = 0
    if (old && dt > 0 && dt <= .5) {
      // Time-based filtering suppresses mask jitter while retaining deliberate motion.
      const blend = 1 - Math.exp(-dt / (p.id.includes('shoulder') ? .035 : .07))
      p.center = { x: old.center.x + (p.center.x - old.center.x) * blend,
        y: old.center.y + (p.center.y - old.center.y) * blend, z: old.center.z + (p.center.z - old.center.z) * blend }
      const rotation = Math.atan2(Math.sin(p.angle - old.angle), Math.cos(p.angle - old.angle))
      angularVelocity = rotation / dt
      angularAcceleration = (angularVelocity - (old.angularVelocity || 0)) / dt
      velocity = mul(sub(p.center, old.center), 1 / dt)
      acceleration = mul(sub(velocity, old.velocity), 1 / dt)
      acceleration = mul(acceleration, Math.min(1, 4000 / (length(acceleration) || 1)))
    }
    return { ...p, velocity, acceleration, angularVelocity, angularAcceleration, previous: old ? { center: old.center, radius: old.radius, angle: old.angle } : undefined, motionDt: dt }
  })
}

function findHead(frame, geometry, nose, width, height) {
  const { mask, maskWidth, maskHeight } = frame
  const { x: offsetX, y: offsetY, imageWidth, imageHeight } = geometry
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity
  let count = 0
  let sourceTop = maskHeight
  const sourceMask = { columns: maskWidth, rows: maskHeight, left: maskWidth, right: -1, hair: 0, face: 0, outsideViewport: 0 }
  const step = imageWidth / maskWidth
  const crown = new Float32Array(maskWidth).fill(NaN)
  const rawHair = new Float32Array(maskWidth).fill(NaN)
  const visibleHair = new Float32Array(maskWidth).fill(NaN)
  for (let row = 0; row < maskHeight; row++) {
    const y = offsetY + (row + .5) * imageHeight / maskHeight
    for (let column = 0; column < maskWidth; column++) {
      const label = mask[row * maskWidth + column]
      if (label !== 1 && label !== 3) continue
      const x = offsetX + (1 - (column + .5) / maskWidth) * imageWidth
      sourceMask.left = Math.min(sourceMask.left, column)
      sourceMask.right = Math.max(sourceMask.right, column)
      if (label === 1) sourceMask.hair++
      else sourceMask.face++
      const mirroredColumn = maskWidth - 1 - column
      if (label === 1 && !Number.isFinite(rawHair[mirroredColumn])) rawHair[mirroredColumn] = y
      if (x < 0 || x > width) {
        sourceMask.outsideViewport++
        continue
      }
      if (label === 1 && y >= 0 && y <= height && !Number.isFinite(visibleHair[mirroredColumn]) &&
        row + 1 < maskHeight && mask[(row + 1) * maskWidth + column] === 1) visibleHair[mirroredColumn] = y
      count++
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      sourceTop = Math.min(sourceTop, row)
      if (y < nose?.y && !Number.isFinite(crown[maskWidth - 1 - column])) crown[maskWidth - 1 - column] = y
    }
  }
  const hairBoundary = { x: offsetX, step, values: rawHair }
  const visibleHairBoundary = { x: offsetX, step, values: visibleHair }
  const bounds = count ? { left, right, top, bottom } : undefined
  if (count <= 8) return { active: false, sourceMask, hairBoundary, visibleHairBoundary, reason: '头发或脸部分割不足', bounds }
  if (sourceTop === 0 || top <= Math.max(2, imageHeight / maskHeight)) {
    return { active: false, sourceMask, hairBoundary, visibleHairBoundary, reason: '头顶接触采集或显示上边缘，请让头顶完整入镜', bounds }
  }
  if (!nose) return { active: false, sourceMask, hairBoundary, visibleHairBoundary, reason: '头部定位不可靠', bounds }
  if (nose.x < left || nose.x > right || top >= height || right - left < 16 || bottom - top < 16) {
    return { active: false, sourceMask, hairBoundary, visibleHairBoundary, reason: '可见头部区域不足或分割与姿态不一致', bounds }
  }
  return { active: true, bounds, sourceMask, hairBoundary, visibleHairBoundary, crown: { x: offsetX, step, values: crown } }
}

export function maskCategoryAt(frame, width, height, point) {
  const geometry = videoGeometry(width, height, frame.videoWidth, frame.videoHeight, frame.mode)
  const x = 1 - (point.x - geometry.x) / geometry.imageWidth
  const y = (point.y - geometry.y) / geometry.imageHeight
  if (x < 0 || x >= 1 || y < 0 || y >= 1) return 0
  return frame.mask[Math.floor(y * frame.maskHeight) * frame.maskWidth + Math.floor(x * frame.maskWidth)]
}

export function maskAt(frame, width, height, point) {
  const category = maskCategoryAt(frame, width, height, point)
  return category >= 1 && category <= 4
}

// Pose shoulders locate joints inside the body. Fit a thin contact band to visible skin/clothing edges.
function fitShoulder(frame, geometry, joint, other, span, width, height) {
  const direction = Math.sign(joint.x - other.x)
  if (!direction || joint.x < 0 || joint.x > width || joint.y < 0 || joint.y > height) return null
  const pixel = geometry.imageWidth / frame.maskWidth
  const samples = []
  const neckLimit = (joint.x + other.x) / 2 + direction * span * .22
  const low = Math.max(0, Math.min(joint.x - span * .15, joint.x + span * .24))
  const high = Math.min(width, Math.max(joint.x - span * .15, joint.x + span * .24))
  for (let x = low; x <= high; x += Math.max(2, pixel / 2)) {
    if ((x - neckLimit) * direction < 0) continue
    for (let y = Math.max(pixel, joint.y - span * .22); y <= Math.min(height - pixel * 2, joint.y + span * .1); y += Math.max(1, geometry.imageHeight / frame.maskHeight)) {
      const label = maskCategoryAt(frame, width, height, { x, y })
      const above = maskCategoryAt(frame, width, height, { x, y: y - pixel * 2 })
      const below = maskCategoryAt(frame, width, height, { x, y: y + pixel * 2 })
      // Hair/face/arm occlusion cannot establish a clothing shoulder surface.
      if (label === 4 && below === 4 && (above === 0 || above === 5)) {
        samples.push({ x, y })
        break
      }
    }
  }
  if (samples.length < 4 || samples.at(-1).x - samples[0].x < span * .1) return null
  const centerX = samples.reduce((sum, p) => sum + p.x, 0) / samples.length
  const centerY = samples.reduce((sum, p) => sum + p.y, 0) / samples.length
  const variance = samples.reduce((sum, p) => sum + (p.x - centerX) ** 2, 0)
  const slope = samples.reduce((sum, p) => sum + (p.x - centerX) * (p.y - centerY), 0) / variance
  if (Math.abs(slope) > 1.5 || samples.some(p => Math.abs(p.y - centerY - slope * (p.x - centerX)) > Math.max(pixel * 2, span * .035))) return null
  const angle = Math.atan(slope)
  const thickness = Math.max(3, Math.min(8, span * .018))
  return { center: { x: centerX - Math.sin(angle) * thickness, y: centerY + Math.cos(angle) * thickness },
    radius: (samples.at(-1).x - samples[0].x) / Math.cos(angle) / 2, thickness, angle }
}
