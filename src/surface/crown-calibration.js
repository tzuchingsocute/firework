// The labeled portrait showed that the steep parts of the mask contour
// receded into the hair. Apply the prior only to supported hair columns.
export function calibrateCrown(crown, hair, bounds, sourcePixel, previous, elapsed) {
  const { step, values } = crown
  const correction = new Float32Array(values.length)
  const calibrated = values.slice()
  const limit = Math.min((bounds.right - bounds.left) * .045, sourcePixel * 5)
  const blend = elapsed > 0 && elapsed < 500 ? 1 - Math.exp(-elapsed / 90) : 1
  for (let index = 3; index < values.length - 3; index++) {
    const y = values[index]
    const left = hair[index - 3]
    const right = hair[index + 3]
    if (![y, left, right, hair[index]].every(Number.isFinite) || Math.abs(y - hair[index]) > sourcePixel) continue
    const slope = Math.abs(right - left) / (6 * step)
    const target = Math.min(limit * Math.min(1, Math.max(0, (slope - .18) / .6)), y - sourcePixel)
    const old = previous?.step === step && previous.x === crown.x ? previous.correction?.[index] ?? target : target
    correction[index] = Math.max(0, Math.min(limit, y - sourcePixel, old + (target - old) * blend))
    calibrated[index] -= correction[index]
  }
  return { ...crown, values: calibrated, correction }
}
