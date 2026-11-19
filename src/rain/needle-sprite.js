export const NEEDLE_TAIL_ROWS = 138

export function makeNeedle(type, color, p) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 192
  const ctx = canvas.getContext('2d')
  const pixels = ctx.createImageData(64, 192)
  const tint = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16))
  for (let y = 0; y < 192; y++) {
    const t = y / 191
    const envelope = Math.max(0, Math.min(1, (1 - t) * 10))
    const head = Math.exp(-(((t - .83) / (.11 * p.elongation)) ** 2))
    const join = (NEEDLE_TAIL_ROWS - 1) / 191
    // Extend the luminous part of the soft tail while preserving the original head and seam brightness.
    const shaftPosition = type.tailFade && t < join ? join * (t / join) ** type.tailFade : t
    const shaft = shaftPosition ** (2.6 / p.elongation) * p.opacity
    const spread = .25 + .75 * t ** p.taper
    for (let x = 0; x < 64; x++) {
      const lateral = (x / 63 * 2 - 1) / spread
      const softness = type.blur * p.blur
      const core = Math.exp(-(lateral ** 2) * (11 - softness * 8))
      const halo = Math.exp(-(lateral ** 2) * 3) * p.glow * (.26 + softness * .48)
      const alpha = (core * (shaft * .46 + head * .67 * p.brightness) + halo * shaft) * envelope * type.brightness
      const index = (y * 64 + x) * 4
      for (let channel = 0; channel < 3; channel++) {
        const cool = 244 + channel * 5
        pixels.data[index + channel] = cool + (tint[channel] - cool) * p.color * (1 - head * .75)
      }
      pixels.data[index + 3] = Math.min(255, alpha * 255)
    }
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}

