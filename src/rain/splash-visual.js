// Optical variants share existing collision particles and never change their physical trajectories.
export function splashType(id) {
  const sample = (Math.imul(id, 0x9e3779b1) >>> 0) / 4294967296
  return sample < .5 ? 'droplet' : sample < .8 ? 'glint' : 'dot'
}

// Designed liquid silhouettes, cached once rather than rebuilt per particle/frame.
let liquidPaths
function liquidPath(index) {
  liquidPaths ??= [
    'M -1 -.2 C -.8 -.75 -.3 -.7 -.05 -.42 Q .1 -.2 .38 -.65 L .65 -.95 Q .55 -.3 .95 -.08 C 1.1 .3 .55 .7 .15 .48 Q -.15 .15 -.34 .6 C -.7 .78 -.6 .05 -1 -.2 Z',
    'M -.9 -.5 Q -.35 -.95 -.1 -.42 C .1 -.1 .55 -.65 .85 -.38 Q 1 -.1 .53 .12 L .95 .48 C .36 .72 .16 .18 -.1 .43 Q -.68 .9 -.58 .23 C -.42 -.1 -.92 -.05 -.9 -.5 Z',
    'M -.95 .2 C -.8 -.25 -.65 -.9 -.15 -.65 Q .14 -.55 .1 -.92 L .53 -.6 Q .28 -.12 .76 -.12 L 1 .25 C .6 .14 .5 .7 .08 .62 Q -.14 .4 -.45 .65 Q -.4 .1 -.95 .2 Z',
    'M -.85 -.48 C -.35 -.75 -.45 -.15 -.1 -.2 Q .35 -.7 .78 -.55 L .5 -.04 Q 1 .1 .65 .5 C .3 .85 -.02 .36 -.25 .55 L -.65 .7 Q -.48 .28 -.8 .1 Q -1 -.1 -.85 -.48 Z',
  ].map(path => new Path2D(path))
  return liquidPaths[index]
}

export function paintSplash(ctx, id, x, y, vx, vy, size, life, opacity, age = 0) {
  const type = splashType(id)
  const variation = (Math.imul(id, 0x85ebca6b) >>> 0) / 4294967296
  const scaleSeed = (Math.imul(id, 0x165667b1) >>> 0) / 4294967296
  // Cull only a subset of auxiliary dots. Physical particle state and trajectories remain intact.
  if (type === 'dot' && scaleSeed < .35) return
  const dropletScale = scaleSeed < .25 ? .9 : scaleSeed < .75 ? 1.5 : 1.85
  const starScale = scaleSeed < .5 ? .65 : scaleSeed < .85 ? 1.1 : 1.65
  const styleSeed = (Math.imul(id, 0x51ed270b) >>> 0) / 4294967296
  const hollow = type === 'glint' && scaleSeed >= .5 && styleSeed < .6
  const fade = Math.max(0, Math.min(1, life))
  if (type === 'glint' && age >= .18) return
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(type === 'glint' ? variation * .7 - .35 : Math.atan2(vy, vx) + (variation-.5)*.4)
  ctx.globalAlpha = opacity * fade
  const shape = new Path2D()
  if (type === 'glint') {
    if (variation < .25) ctx.transform(.78, .12, -.18, 1, 0, 0)
    const phase = age / .18
    const growth = phase < .2 ? .65 + phase * 1.75 : 1 - (phase-.2)*.65
    const radius = (4 + variation * 3) * growth * starScale
    const horizontal = radius * (.72 + variation * .22)
    const lower = radius * (.85 + variation * .12)
    const waist = radius * .16
    shape.moveTo(0, -radius)
    shape.bezierCurveTo(waist, -waist, waist, -waist, horizontal, 0)
    shape.bezierCurveTo(waist, waist, waist, waist, 0, lower)
    shape.bezierCurveTo(-waist, waist, -waist, waist, -horizontal, 0)
    shape.bezierCurveTo(-waist, -waist, -waist, -waist, 0, -radius)
    shape.closePath()
    ctx.globalAlpha = opacity * Math.min(1,phase/.12) * (1-phase) ** .7
    ctx.fillStyle = '#e8f8ff'
  } else if (type === 'droplet') {
    const radius = size * (1.25 + variation * .8) * dropletScale
    const length = radius * (1.05 + Math.min(.6,Math.hypot(vx,vy)/230))
    const variant = (Math.imul(id, 0x27d4eb2d) >>> 0) % 4
    shape.addPath(liquidPath(variant), new DOMMatrix([length,0,0,radius,0,0]))
    const light = ctx.createRadialGradient(length*.22,-radius*.2,0,0,0,length*1.2)
    light.addColorStop(0,'#e8f8ff')
    light.addColorStop(.4,'#b4cad8')
    light.addColorStop(1,'rgba(169,210,213,.3)')
    ctx.fillStyle = light
  } else {
    shape.ellipse(0,0,size*.65,size*.6,0,0,Math.PI*2)
    ctx.fillStyle = '#a5dcfa'
  }
  // A crisp vector fill remains over a restrained colored halo.
  ctx.shadowColor = 'rgba(105,185,210,.35)'
  ctx.shadowBlur = type === 'glint' ? 2 : 1
  if (hollow) {
    // A true transparent interior: stroke the existing silhouette, never paint a center fill.
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#e8f4f8'
    ctx.lineWidth = .75
    ctx.lineJoin = 'round'
    ctx.stroke(shape)
  } else ctx.fill(shape)
  ctx.restore()
}
