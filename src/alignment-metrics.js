export const scenes = {
  front: '正面', left: '向左转头', right: '向右转头', up: '抬头', down: '低头', translate: '左右平移',
}

export const anchors = [
  { id: 'leftEye', index: 263, label: '左眼外眼角' },
  { id: 'rightEye', index: 33, label: '右眼外眼角' },
  { id: 'nose', index: 1, label: '鼻尖' },
  { id: 'leftMouth', index: 291, label: '左嘴角' },
  { id: 'rightMouth', index: 61, label: '右嘴角' },
]

function summarize(errors) {
  const sorted = errors.map(error => error.normalized).sort((a, b) => a - b)
  const mean = field => errors.reduce((sum, error) => sum + error[field], 0) / errors.length
  return { mean: mean('normalized'), p95: sorted[Math.ceil(sorted.length * .95) - 1],
    max: sorted.at(-1), offset: Math.hypot(mean('dx'), mean('dy')) }
}

export function measureSample(sample) {
  const { width, height, reference, predicted } = sample
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) throw new Error('画布尺寸无效。')
  const inBounds = p => p && Number.isFinite(p.x) && Number.isFinite(p.y)
    && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height
  if (!anchors.every(({ id }) => inBounds(reference?.[id]) && inBounds(predicted?.[id]))) {
    throw new Error('请选择五官均在画面内的帧，并完成五点标注。')
  }
  const eyeDistance = Math.hypot(reference.rightEye.x - reference.leftEye.x, reference.rightEye.y - reference.leftEye.y)
  if (eyeDistance < 8) throw new Error('人工标注的双眼外眼角距离须至少为 8 像素。')
  const ordered = points => points.leftEye.x < points.rightEye.x && points.leftMouth.x < points.rightMouth.x
  const errors = anchors.map(({ id, label, index }) => {
    const x = predicted[id].x - reference[id].x
    const y = predicted[id].y - reference[id].y
    const pixels = Math.hypot(x, y)
    return { id, label, index, pixels, normalized: pixels / eyeDistance, dx: x / eyeDistance, dy: y / eyeDistance }
  })
  return { eyeDistance, errors, ...summarize(errors), sidesCorrect: ordered(reference) && ordered(predicted) }
}

export function summarizeSamples(samples) {
  const measured = Object.entries(samples).map(([scene, sample]) => ({ scene, ...measureSample(sample) }))
  if (!measured.length) return null
  const complete = Object.keys(scenes).every(key => Object.hasOwn(samples, key))
  const aggregate = summarize(measured.flatMap(sample => sample.errors))
  const sidesCorrect = measured.every(sample => sample.sidesCorrect)
  const limit = .05 + Number.EPSILON // Ignore floating-point accumulation at the inclusive threshold.
  const pass = complete && aggregate.mean <= limit && aggregate.offset <= limit && sidesCorrect
  return { ...aggregate, sidesCorrect, complete, pass, scenes: measured }
}
