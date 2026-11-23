// Adapted from https://starvoid.cn/6laZc. Original HTML: previews/starvoid-6laZc.html.
// Canvas drawing only. The live controller owns scheduling and lifecycle.
const SATURATION = 30
const MAX_ROCKETS = 4
const MAX_SPARKS = 1600

export function createSpriteFirework(canvas) {
  const TAU = Math.PI * 2
  const rand = (a, b) => a + Math.random() * (b - a)
  const randi = (a, b) => Math.floor(rand(a, b + 1))

  const ctx = canvas.getContext('2d')
  let W = 0,
    H = 0,
    DPR = 1,
    disposed = false
  function resize(width, height, density = 1) {
    const dpr = Math.min(density, 2)
    if (W === width && H === height && DPR === dpr) return
    W = width
    H = height
    DPR = dpr
    canvas.width = Math.max(1, Math.round(W * DPR))
    canvas.height = Math.max(1, Math.round(H * DPR))
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  }

  // ---- 发光贴图:每种色相预渲染一张径向渐变,drawImage 远比逐粒子渐变便宜 ----
  const sprites = new Map()
  function sprite(hue, whiteCore) {
    const key = Math.round(hue / 6) * 6 + (whiteCore ? 'w' : 'c')
    if (sprites.has(key)) return sprites.get(key)
    const s = 64,
      c = document.createElement('canvas')
    c.width = c.height = s
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    if (whiteCore) {
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.18, `hsla(${hue},${SATURATION}%,78%,.95)`)
      grad.addColorStop(0.45, `hsla(${hue},${SATURATION}%,58%,.16)`)
      grad.addColorStop(1, `hsla(${hue},${SATURATION}%,50%,0)`)
    } else {
      grad.addColorStop(0, `hsla(${hue},${SATURATION}%,80%,1)`)
      grad.addColorStop(0.35, `hsla(${hue},${SATURATION}%,60%,.20)`)
      grad.addColorStop(1, `hsla(${hue},${SATURATION}%,50%,0)`)
    }
    g.fillStyle = grad
    g.fillRect(0, 0, s, s)
    sprites.set(key, c)
    return c
  }

  // Full-spectrum random colors, matching the original HTML's neon theme.
  const themeHue = () => rand(0, 360)
  const themeEmber = () => rand(0, 360)

  // ---- 实体 ----
  const rockets = [],
    sparks = [],
    flashes = [],
    embers = []

  function launchRocket(tx, ty, opts = {}) {
    if (disposed || W <= 0 || H <= 0 || rockets.length >= MAX_ROCKETS)
      return false
    const sx = tx != null ? tx + rand(-30, 30) : rand(W * 0.15, W * 0.85)
    const targetY = ty != null ? ty : rand(H * 0.12, H * 0.45)
    const hue = opts.hue != null ? opts.hue : themeHue()
    rockets.push({
      x: sx,
      y: H + 10,
      vx: rand(-0.6, 0.6),
      vy: -rand(H * 0.011, H * 0.014),
      targetY,
      hue,
      size: opts.size || rand(0.85, 1.25),
      type: opts.type || pickType(),
      trail: [],
    })
    return { hue }
  }

  function pickType() {
    const r = Math.random()
    if (r < 0.34) return 'peony'
    if (r < 0.52) return 'chrys'
    if (r < 0.68) return 'ring'
    if (r < 0.84) return 'double'
    return 'strobe'
  }

  function addSpark(x, y, angle, speed, hue, o = {}) {
    if (sparks.length >= MAX_SPARKS) return
    const depth = o.depth != null ? o.depth : rand(0.55, 1.35) // 景深:远的暗而小、虚
    sparks.push({
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(angle) * speed * depth,
      vy: Math.sin(angle) * speed * depth,
      hue,
      depth,
      life: 0,
      ttl: o.ttl || rand(55, 95),
      drag: o.drag || 0.962,
      grav: o.grav != null ? o.grav : 0.045,
      size: (o.size || rand(1.6, 2.6)) * depth,
      strobe: o.strobe || 0,
      twinkle: Math.random() < 0.25,
      seed: Math.random() * TAU,
      trail: o.trail !== false,
      split: o.split || 0,
      whiteCore: Math.random() < 0.5,
    })
  }

  function explode(x, y, hue, size, type) {
    const R = Math.min(W, H) * 0.0022 * size // 基准速度随屏幕缩放
    flashes.push({ x, y, hue, life: 0, ttl: 14, r: 90 * size })

    if (type === 'peony' || type === 'double') {
      const n = Math.round(90 * size)
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU),
          sp = R * rand(2.6, 5.4) * Math.pow(Math.random(), 0.35)
        addSpark(x, y, a, sp, hue + rand(-12, 12), {
          ttl: rand(50, 85),
          size: rand(1.9, 3.1),
        })
      }
      if (type === 'double') {
        const h2 = themeHue()
        for (let i = 0; i < 50 * size; i++) {
          const a = rand(0, TAU)
          addSpark(x, y, a, R * rand(1.1, 2.0), h2, {
            ttl: rand(65, 100),
            depth: rand(0.8, 1.2),
            whiteCore: true,
          })
        }
      }
    } else if (type === 'chrys') {
      const n = Math.round(110 * size)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rand(-0.03, 0.03)
        addSpark(x, y, a, R * rand(3.4, 4.2), hue + rand(-8, 8), {
          ttl: rand(70, 105),
          drag: 0.968,
          grav: 0.055,
          split: Math.random() < 0.3 ? randi(40, 60) : 0,
        })
      }
    } else if (type === 'ring') {
      const n = 70,
        tilt = rand(0.35, 0.8),
        rot = rand(0, TAU)
      const h2 = themeHue()
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU
        const vx = Math.cos(a) * R * 4.0,
          vy = Math.sin(a) * R * 4.0 * tilt
        const rx = vx * Math.cos(rot) - vy * Math.sin(rot)
        const ry = vx * Math.sin(rot) + vy * Math.cos(rot)
        if (sparks.length < MAX_SPARKS) {
          sparks.push({
            x,
            y,
            px: x,
            py: y,
            vx: rx,
            vy: ry,
            hue: h2,
            depth: 1,
            life: 0,
            ttl: rand(60, 80),
            drag: 0.965,
            grav: 0.04,
            size: 2.2,
            strobe: 0,
            twinkle: false,
            seed: 0,
            trail: true,
            split: 0,
            whiteCore: true,
          })
        }
      }
      for (let i = 0; i < 26; i++)
        addSpark(x, y, rand(0, TAU), R * rand(0.5, 1.4), hue, {
          ttl: rand(40, 60),
        })
    } else if (type === 'willow') {
      const n = Math.round(80 * size)
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU),
          sp = R * rand(2.4, 3.8)
        addSpark(x, y, a, sp, rand(36, 50), {
          ttl: rand(150, 220),
          drag: 0.982,
          grav: 0.028,
          size: rand(1.3, 2.0),
          strobe: 0,
        })
      }
    } else if (type === 'strobe') {
      const n = Math.round(85 * size)
      const h2 = themeHue()
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU),
          sp = R * rand(1.8, 4.0) * Math.pow(Math.random(), 0.4)
        addSpark(x, y, a, sp, Math.random() < 0.6 ? hue : h2, {
          ttl: rand(80, 130),
          strobe: randi(4, 9),
          grav: 0.035,
          whiteCore: true,
        })
      }
    }

    // 中心余烬:爆炸后缓缓坠落的金色尘埃
    const ne = Math.round(14 * size)
    for (let i = 0; i < ne; i++) {
      embers.push({
        x: x + rand(-14, 14),
        y: y + rand(-14, 14),
        vx: rand(-0.5, 0.5),
        vy: rand(-0.3, 0.6),
        hue: themeEmber(),
        life: 0,
        ttl: rand(120, 200),
        size: rand(0.8, 1.8),
        seed: Math.random() * TAU,
      })
    }
    shake = Math.min(shake + 3.2 * size, 9)
  }

  // ---- 主循环 ----
  let shake = 0,
    last = null
  let idleFrames = 3

  function frame(t) {
    if (disposed) return
    const dt = last === null ? 1 : Math.min((t - last) / 16.667, 2.5) || 1
    last = t

    const busy =
      rockets.length ||
      sparks.length ||
      flashes.length ||
      embers.length
    if (!busy) {
      idleFrames++
      if (idleFrames === 3) ctx.clearRect(0, 0, W, H) // 静止时彻底清空,保证 OBS 全透明
      return
    }
    idleFrames = 0

    // 残影衰减:destination-out 让旧帧渐隐到透明(而不是涂黑),拖尾即光轨
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(0, 0, W, H)

    ctx.globalCompositeOperation = 'lighter'

    const shaking = shake > 0.1
    if (shaking) {
      ctx.save()
      ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5)
      shake *= Math.pow(0.86, dt)
    }

    // 上升的火箭
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]
      r.px = r.x
      r.py = r.y
      r.x += r.vx * dt
      r.y += r.vy * dt
      r.vy *= Math.pow(0.995, dt)
      r.trail.push({ x: r.x, y: r.y })
      if (r.trail.length > 9) r.trail.shift()

      ctx.strokeStyle = `hsla(${r.hue},${SATURATION}%,72%,.5)`
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let j = 0; j < r.trail.length; j++) {
        const p = r.trail[j]
        j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)
      }
      ctx.stroke()
      const sp = sprite(r.hue, true),
        s = 14
      ctx.drawImage(sp, r.x - s / 2, r.y - s / 2, s, s)

      // 上升途中洒落的小火星
      if (Math.random() < 0.5) {
        embers.push({
          x: r.x + rand(-2, 2),
          y: r.y + rand(0, 6),
          vx: rand(-0.3, 0.3),
          vy: rand(0.2, 0.8),
          hue: r.hue,
          life: 0,
          ttl: rand(18, 36),
          size: rand(0.6, 1.2),
          seed: 0,
        })
      }
      if (r.y <= r.targetY || r.vy > -1.2) {
        rockets.splice(i, 1)
        explode(r.x, r.y, r.hue, r.size, r.type)
      }
    }

    // 爆炸闪光:一帧炽白核心 + 大团色晕
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]
      f.life += dt
      const k = f.life / f.ttl
      if (k >= 1) {
        flashes.splice(i, 1)
        continue
      }
      const a = Math.pow(1 - k, 2.2) * 0.55
      const r = f.r * (0.7 + k * 1.4)
      const sp = sprite(f.hue, true)
      ctx.globalAlpha = a
      ctx.drawImage(sp, f.x - r, f.y - r, r * 2, r * 2)
      ctx.globalAlpha = 1
    }

    // 火花:光轨线段 + 发光头
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]
      p.life += dt
      if (p.life >= p.ttl) {
        sparks.splice(i, 1)
        continue
      }
      p.px = p.x
      p.py = p.y
      p.vx *= Math.pow(p.drag, dt)
      p.vy = p.vy * Math.pow(p.drag, dt) + p.grav * dt
      p.x += p.vx * dt
      p.y += p.vy * dt

      // 菊花型的二次爆裂
      if (p.split && p.life >= p.split) {
        p.split = 0
        for (let j = 0; j < 4; j++) {
          addSpark(p.x, p.y, rand(0, TAU), rand(0.4, 1.2), p.hue, {
            ttl: rand(20, 40),
            size: 1.2,
            depth: p.depth,
          })
        }
      }

      const k = p.life / p.ttl
      let a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
      a *= Math.min(p.depth, 1) * 0.9 + 0.1
      if (p.strobe && Math.floor(p.life / p.strobe) % 2 === 1) a *= 0.06
      if (p.twinkle) a *= 0.6 + 0.4 * Math.sin(p.seed + p.life * 0.9)
      if (a <= 0.02) continue

      const dim = p.depth < 0.8 ? 0.55 : 1 // 远景更暗
      ctx.globalAlpha = a * dim
      if (p.trail) {
        ctx.strokeStyle = `hsla(${p.hue},${SATURATION}%,${p.whiteCore ? 78 : 64}%,.85)`
        ctx.lineWidth = p.size * (1 - k * 0.5)
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(p.px, p.py)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
      const s = p.size * 6.5 * (1 - k * 0.35)
      ctx.drawImage(sprite(p.hue, p.whiteCore), p.x - s / 2, p.y - s / 2, s, s)
      ctx.globalAlpha = 1
    }

    // 余烬尘埃
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i]
      e.life += dt
      if (e.life >= e.ttl) {
        embers.splice(i, 1)
        continue
      }
      e.vy += 0.012 * dt
      e.vx += Math.sin(e.seed + e.life * 0.05) * 0.01
      e.x += e.vx * dt
      e.y += e.vy * dt
      const k = e.life / e.ttl
      const a =
        (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) *
        (0.5 + 0.5 * Math.sin(e.seed + e.life * 0.35))
      if (a <= 0.02) continue
      ctx.globalAlpha = a * 0.8
      const s = e.size * 4
      ctx.drawImage(sprite(e.hue, false), e.x - s / 2, e.y - s / 2, s, s)
      ctx.globalAlpha = 1
    }

    if (shaking) ctx.restore()
    ctx.globalCompositeOperation = 'source-over'
  }

  function clear() {
    rockets.length =
      sparks.length =
      flashes.length =
      embers.length =
        0
    shake = 0
    last = null
    idleFrames = 3
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, W, H)
  }
  return {
    resize,
    launch: launchRocket,
    step: frame,
    clear,
    get playing() {
      return Boolean(
        rockets.length ||
          sparks.length ||
          flashes.length ||
          embers.length ||
          idleFrames < 3,
      )
    },
    get stats() {
      return {
        rockets: rockets.length,
        sparks: sparks.length,
        embers: embers.length,
        active:
          rockets.length +
          sparks.length +
          flashes.length +
          embers.length,
        sprites: sprites.size,
      }
    },
    dispose() {
      clear()
      sprites.clear()
      disposed = true
    },
  }
}
