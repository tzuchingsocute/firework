import { makeNeedle, NEEDLE_TAIL_ROWS } from './needle-sprite.js'

const appearance = Object.freeze({
  size: 1.3, core: 1, brightness: 1, halo: .65, trail: 1,
  micro: 45, glow: 45, glint: 10, frequency: 1,
})

function softenNeedle(source, radius) {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  ctx.filter = `blur(${radius}px)`
  ctx.drawImage(source, 0, 0)
  return canvas
}

export function createDropletAppearance(ctx, config = appearance) {
  const profiles = [
    { width: 2.8, length: 24, trailMin: 16, trailMax: 22, brightness: .75, blur: .08, elongation: .9 },
    { width: 5.5, length: 56, trailMin: 67, trailMax: 99, brightness: 1, blur: .25, elongation: 1.55 },
    { width: 7.2, length: 64, trailMin: 180, trailMax: 235, tailFade: .43, brightness: .52, blur: .95, elongation: 1.45 },
  ]
  const colors = ['#E8F8FF', '#A5DCFA', '#69B9D2', '#477DAB']
  let atlas
  let softAtlas
  let cachedGlow
  let cachedOpacity

  return (drop, radius, alpha, length, params, bounds) => {
    if (config.original) return false
    const glow = params.glow * config.halo
    if (!atlas || cachedGlow !== glow || cachedOpacity !== params.trailOpacity) {
      atlas = profiles.map(profile => colors.map(color => makeNeedle(profile, color, {
        elongation: profile.elongation, taper: 1.1, opacity: params.trailOpacity,
        glow: params.glow * config.halo, blur: .9, color: .8, brightness: 1,
      })))
      softAtlas = atlas.map((variants, type) => variants.map(sprite =>
        softenNeedle(sprite, [6, 11, 6.5][type])))
      cachedOpacity = params.trailOpacity
      cachedGlow = glow
    }
    const sample = (Math.imul(drop.id, 0x9e3779b1) >>> 0) / 4294967296
    const total = config.micro + config.glow + config.glint * config.frequency
    const type = !total || sample * total < config.micro ? 0
      : sample * total < config.micro + config.glow ? 1 : 2
    const hue = drop.phase / (2 * Math.PI)
    const focusSeed = (Math.imul(drop.id, 0x27d4eb2d) >>> 0) / 4294967296
    const focus = focusSeed < .65 ? 0 : focusSeed < .95 ? 1 : 2
    const foregroundMix = drop.lensForeground ? drop.foregroundMix ?? 0 : 0
    const palette = drop.lensForeground && focus > 0 ? (hue < .65 ? 1 : 2) : hue < .15 ? 0 : hue < .65 ? 1 : hue < .9 ? 2 : 3
    const profile = profiles[type]
    const scaleSeed = (Math.imul(drop.id, 0x165667b1) >>> 0) / 4294967296
    const widthEmphasis = type === 1 && !drop.lensForeground && scaleSeed < .35
      ? 1.2 + scaleSeed / .35 * .1 : 1
    const w = widthEmphasis * profile.width * (config.size / 1.3) * config.core * config.trail *
      (params.core / .95) ** .55 * (.85 + drop.size * .18)
    const scale = Math.max(.18, params.trail)
    const originalHeight = profile.length * (.75 + drop.tail * .25) * scale
    // Bands are expressed at the approved 1.95 trail setting, independently of fall speed.
    const variation = Math.max(0, Math.min(1, (drop.tail - .45) / .85))
    const newHeight = (profile.trailMin + (profile.trailMax - profile.trailMin) * variation) * scale / 1.95
    const sprite = atlas[type][palette]
    // Resize the fading upper section, leaving the bright leading section at its original size.
    const split = NEEDLE_TAIL_ROWS
    const frontHeight = originalHeight * (1 - split / sprite.height)
    const tailHeight = newHeight - frontHeight
    const frontY = originalHeight * .14 - frontHeight
    const { x, y } = drop
    const opacity = Math.min(1, alpha * config.brightness * (type === 1 ? 1.35 : 1.12))
    const progress = bounds ? (drop.y - bounds.y) / bounds.height : 0
    const onset = .16 + (hue - .5) * .06
    const phase = Math.max(0, Math.min(1, (progress - onset) / .58))
    const eased = phase * phase * (3 - 2 * phase)
    const oldForegroundWeight = .92 + phase * .06
    const mixedWeight = focus === 0 ? .85 + eased * .12
      : focus === 1 ? .48 + eased * .35 : .3 + eased * .44
    const softWeight = drop.lensForeground
      ? oldForegroundWeight + (mixedWeight - oldForegroundWeight) * foregroundMix
      : eased * [.78, .96, .62][type]
    const sharpContrast = drop.lensForeground && focus > 0 ? 1 + foregroundMix * (focus === 1 ? 1.35 : 2.0) : 1
    ctx.setTransform(1, 0, drop.vx / drop.vy, 1, x, y)
    // Crossfade cached textures inside the original sprite footprint.
    // Both contributions retain the same dimensions and pass through the existing masks.
    ctx.globalAlpha = Math.min(1, opacity * (1 - softWeight) * sharpContrast)
    ctx.drawImage(sprite, 0, 0, sprite.width, split, -w / 2, frontY - tailHeight, w, tailHeight)
    ctx.drawImage(sprite, 0, split, sprite.width, sprite.height - split, -w / 2, frontY, w, frontHeight)
    if (softWeight > 0) {
      const soft = softAtlas[type][palette]
      ctx.globalAlpha = opacity * softWeight
      ctx.drawImage(soft, 0, 0, soft.width, split, -w / 2, frontY - tailHeight, w, tailHeight)
      ctx.drawImage(soft, 0, split, soft.width, soft.height - split, -w / 2, frontY, w, frontHeight)
    }
    ctx.resetTransform()
    ctx.globalAlpha = 1
    return true
  }
}
