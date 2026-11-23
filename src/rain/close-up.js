import { width } from './rain.js'

export function createCloseUpWeight() {
  let weight = 0
  let lastFace = -Infinity
  let target = 0
  return (scene, bounds, now, dt) => {
    const videoWidth = bounds.width * scene.width / width
    const facePoints = (scene.face?.points ?? []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
    let ratio
    if (facePoints.length >= 2 && videoWidth > 0) {
      ratio = (Math.max(...facePoints.map(p => p.x)) - Math.min(...facePoints.map(p => p.x))) / videoWidth
    }
    // A fresh face-class segmentation can remain usable when the protected face polygon is stale.
    const mask = scene.personMask
    if (mask && scene.faceCoverage > .38) {
      ratio = Math.max(ratio ?? 0, Math.sqrt(scene.faceCoverage))
    }
    if (Number.isFinite(ratio)) {
      const phase = Math.max(0, Math.min(1, (ratio - .52) / .4))
      target = phase * phase * (3 - 2 * phase)
      lastFace = now
    } else if (now - lastFace > 1500) target = 0
    weight += (target - weight) * (1 - Math.exp(-dt / .65))
    return weight
  }
}
