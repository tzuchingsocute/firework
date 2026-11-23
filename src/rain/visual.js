import { paintSplash, splashType } from './splash-visual.js'
import { createCloseUpWeight } from './close-up.js'
import { createOriginalDroplet } from "./original-droplet.js"
import { createPersonOcclusion, keepVisible } from './visibility.js'
import { createDropletAppearance } from './droplet-appearance.js'
import { createEffectController } from './effect-controller.js'
import { obscuringPalm, paintShoulderEffect, shoulderOcclusion } from '../hand/occlusion.js'
import { createAdaptiveRegions } from './adaptive.js'
import { createHandTracking } from '../hand/tracking.js'
import { visibleVideoRect } from '../projection.js'
import { eraseFace, facePath, insideFace } from '../surface/quality.js'
import { world } from '../surface/physics.js'
import { createInteraction } from './interaction.js'
import { approvedPresetName, createRain, defaults, fallingSpeed, width, height } from './rain.js'

export function mountVisualRain(surface, expressions, firework) {
  const panel = document.querySelector('#visual-rain')
  const canvas = document.querySelector('#visual-rain-canvas')
  const ctx = canvas.getContext('2d')
  const paintOriginal = createOriginalDroplet(ctx)
  const paintFalling = createDropletAppearance(ctx)
  const room = canvas.closest('.live-room')
  const video = room.querySelector('video')
  const boundsStatus = panel.querySelector('[data-video-bounds]')
  const occludePerson = createPersonOcclusion()
  const visibilityPanel = panel.querySelector('#rain-visibility')
  const sourceFilter = visibilityPanel.querySelector('select')
  const showVisibilityFace = visibilityPanel.querySelector('[data-visibility-face]')
  const showPerson = visibilityPanel.querySelector('[data-person-mask]')
  let terminated = 0
  let visibilityEvent = '—'
  let lastBirth = '—'
  let bounds
  const rain = createRain()
  let foregroundSeed = 3187
  const foreground = createRain(() => ((foregroundSeed = (Math.imul(foregroundSeed, 1664525) + 1013904223) >>> 0) / 2 ** 32))
  const closeUpWeight = createCloseUpWeight()
  let closeWeight = 0
  const foregroundParams = { ...defaults, density: defaults.density * .075 }
  const hands = createHandTracking(video)
  const updateRegions = createAdaptiveRegions()
  const adaptivePanel = panel.querySelector('#adaptive-interaction')
  const adaptiveStatus = adaptivePanel.querySelector('output')
  const adaptiveDebug = Object.fromEntries([...adaptivePanel.querySelectorAll('[data-adaptive-debug]')].map(
    input => [input.dataset.adaptiveDebug, input]))
  let regions
  let response
  const interaction = createInteraction(insideFace, hit => {
    hands.impact(hit)
    if (response?.generated !== undefined && response.head === undefined && hit.response === response && hit.surface === 'head') {
      response.head = performance.now() - response.started
    }
  })
  const mode = panel.querySelector('[data-rain-mode]')
  const toggles = Object.fromEntries([...panel.querySelectorAll('[data-rain-debug]')].map(
    input => [input.dataset.rainDebug, input]))
  let scene
  const interactive = () => mode.value === 'interactive'
  function syncInteraction() {
    surface.setInteractive(interactive() && state !== 'stopped')
  }
  const params = defaults
  panel.querySelector('[data-rain-preset]').textContent = approvedPresetName
  const speedStatus = panel.querySelector('[data-effective-speed]')
  const responseStatus = panel.querySelector('[data-rain-response]')
  const stats = panel.querySelector(':scope > div > output')
  const old = document.querySelector('#surface-enabled')
  let state = 'stopped'
  let frame = 0
  let previous
  let sampleStart
  let frameCount = 0
  let fps = 0
  const trigger = panel.querySelector('[data-effect-trigger]')
  const effectStatus = panel.querySelector('[data-effect-status]')
  const effect = createEffectController(expressions, play, () => performance.now(), firework)
  const manualButtons = ['play','pause','restart','stop'].map(action => panel.querySelector('[data-' + action + ']'))
  expressions?.addEventListener('expression:smile:start', event => {
    if (trigger.value === 'expression') response = { started: event.detail.timestamp }
  })
  trigger.onchange = () => {
    response = undefined
    effect.setMode(trigger.value)
    manualButtons.forEach(button => { button.disabled = trigger.value === 'expression' })
    if (trigger.value === 'expression' && state === 'paused') play()
    status()
  }


  function status() {
    hands.syncEnabled(interactive())
    const statusLabel = { playing: '播放中', paused: '已暂停', stopped: '已停止' }[state]
    effectStatus.textContent = effect.describe()
    const actual = fallingSpeed(params, bounds?.height ?? height)
    speedStatus.textContent = `主速度 ${actual.toFixed(1)} 设计像素/秒 · ${bounds?.height ? (actual / bounds.height).toFixed(3) : '—'} 视频高度/秒 · 按视频高度`
    const ms = value => value === undefined ? '待记录' : Math.round(value) + ' ms'
    responseStatus.textContent = response ? `微笑确认后 · 首滴生成 ${ms(response.generated)} · 首滴中心进入画面 ${ms(response.visible)} · 首次头顶命中 ${ms(response.head)}` : '' 
    stats.textContent = `${statusLabel} · ${rain.drops.length} 个雨滴 · 每秒 ${fps} 帧${interactive() ? scene?.patches.length ? ` · ${scene.patches.length} 个碰撞表面` : ' · 等待有效人体表面' : ''}`
  }

  function updateBounds() {
    const next = visibleVideoRect(video, room, width, height)
    if (bounds && !Object.keys(next).some(key => Math.abs(next[key] - bounds[key]) > .01)) return false
    if (bounds) {
      rain.reset()
      foreground.reset()
      interaction.reset()
    }
    bounds = next
    canvas.dataset.videoBounds = JSON.stringify(bounds)
    return true
  }

  function paint() {
    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.beginPath()
    ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height)
    ctx.clip()
    if (state !== 'stopped') paintRain()
    ctx.restore()
    boundsStatus.hidden = !toggles.bounds.checked
    if (toggles.bounds.checked) {
      const { x, y, width: w, height: h } = bounds
      const format = n => n.toFixed(2)
      const label = `视频 X ${format(x)} · Y ${format(y)} · 宽 ${format(w)} · 高 ${format(h)} · 雨滴起点 Y ${format(y)} · 渲染范围 [${format(x)}, ${format(y)}]–[${format(x + w)}, ${format(y + h)}]`
      if (boundsStatus.textContent !== label) boundsStatus.textContent = label
      ctx.strokeStyle = '#6fead0'
      ctx.strokeRect(x + .5, y + .5, Math.max(0, w - 1), Math.max(0, h - 1))
    }
  }

  function paintRain() {
    const mode = sourceFilter.value
    const ar = interactive() && scene?.width && scene.height
    const sx = ar ? width / scene.width : 1
    const sy = ar ? height / scene.height : 1
    if (mode === 'all' || mode === 'falling') {
      if (ar && scene.personMask) {
        for (const drop of rain.drops) if (drop.background) paintDrop(drop, true)
        occludePerson(ctx, scene, sx, sy)
      }
      for (const drop of rain.drops) if (!ar || !drop.background || !scene.cameraActive && !scene.personMask) paintDrop(drop, true)
    }
    if (!interactive() || !scene?.width || !scene.height) return
    for (const drop of interaction.droplets) {
      if (drop.splash && drop.suppressSplash) continue
      const head = drop.rainSource === 'head' || drop.rainSource === 'hair'
      const inside = drop.position.y >= 0 && drop.position.y <= scene.stageHeight &&
        drop.position.x >= 0 && drop.position.x <= scene.width
      if (head && !inside) drop.visuallyTerminated = true
      const from = drop.lastVisibilityPosition ?? drop.position
      drop.lastVisibilityPosition = drop.position
      if (!keepVisible(drop, scene.face, from, drop.position)) continue
      if (mode === 'falling' || mode === 'impact' && (!head || !drop.splash) ||
          mode === 'attached' && (!head || drop.splash)) continue
      if (drop.splash) drop.visualAge = (drop.visualAge ?? 0) + (drop.lastVisualTime === undefined ? 0 : Math.max(0,performance.now()-drop.lastVisualTime)/1000)
      drop.lastVisualTime = performance.now()
      if (drop.splash && splashType(drop.id) === 'glint') {
        drop.sparkAnchor ??= { ...drop.position }
      }
      const particle = {
      x: drop.position.x * sx, y: (drop.position.y + scene.stageTop) * sy,
      size: drop.splash ? .67 : .87, depth: .6, brightness: (drop.splash ? .76 : .87) * (drop.effectWeight ?? 1),
      life: Math.min(1, drop.life * 2.4) * (drop.visibility ?? 1), age: drop.age ?? 0, phase: 0, tail: 0, vy: 0,
      }
      const relation = obscuringPalm(scene.occlusion ?? [], drop.origin, drop.position, 12)
      const paint = opacity => {
        if (drop.splash) paintSplash(ctx, drop.id,
          drop.sparkAnchor ? drop.sparkAnchor.x * sx : particle.x,
          drop.sparkAnchor ? (drop.sparkAnchor.y + scene.stageTop) * sy : particle.y,
          drop.velocity.x * sx, drop.velocity.y * sy, 1.25, particle.life,
          particle.brightness * opacity, drop.visualAge)
        else paintDrop({ ...particle, brightness: particle.brightness * opacity })
      }
      if (!relation) { paint(1); continue }
      const palm = relation.palm
      const outline = new Path2D()
      const stageTransform = new DOMMatrix([sx, 0, 0, sy, 0, scene.stageTop * sy])
      const localEllipse = new Path2D()
      localEllipse.ellipse(palm.center.x, palm.center.y, palm.radius.x, palm.radius.y, palm.angle, 0, Math.PI * 2)
      outline.addPath(localEllipse, stageTransform)
      paintShoulderEffect(ctx, outline, relation.opacity, width, height,
        paint)
    }
    // Contact optics share the final face mask and the same visible-video clip as the rain.
    if (mode === 'all' || mode === 'impact') for (const hit of interaction.impacts) {
      const age = .65 - hit.life
      if (hit.feedbackLevel === 0 || !hit.visible || age > .36 || hit.surface === 'face') continue
      if (!keepVisible(hit, scene.face, hit, hit)) continue
      const relation = obscuringPalm(scene.occlusion ?? [], hit.surface, hit, 18)
      const draw = opacity => {
        ctx.save()
        ctx.translate(hit.x * sx, (hit.y + scene.stageTop) * sy)
        ctx.scale(sx, sy)
        ctx.rotate(Math.atan2(hit.normal?.y ?? -1, hit.normal?.x ?? 0) + Math.PI / 2)
        const weight = hit.visualWeight * opacity
        if (age < .085) {
          ctx.globalAlpha = weight * (1 - age / .085) * .85
          ctx.fillStyle = '#e8f8ff'
          ctx.beginPath()
          ctx.ellipse(0, 0, 1.8, .85, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        if (age > .025 && age < .29) {
          const progress = (age - .025) / .265
          ctx.globalAlpha = weight * (1 - progress) ** 1.5 * .46
          ctx.strokeStyle = '#a5dcfa'
          ctx.lineWidth = .65
          ctx.beginPath()
          ctx.ellipse(0, -.4, 2 + progress * 7, .7 + progress * 2, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
        for (const [index, spark] of (hit.sparks ?? []).entries()) {
          if (age < .035 || age > spark.duration) continue
          const t = age - .035
          let visualId = hit.id * 7 + index + 1
          if (hit.surface === 'head' || hit.surface === 'hair') {
            // Keep light feedback restrained; emphasized contacts use the shared 50/30/20 mix.
            if (hit.feedbackLevel === 1) while (splashType(visualId) === 'glint') visualId++
          }
          const nearContact = splashType(visualId) === 'glint'
          const travel = nearContact ? Math.min(t,.018) : t
          const point = { x: hit.x + spark.vx * travel, y: hit.y + spark.vy * travel + 32 * travel * travel }
          if (!keepVisible(spark, scene.face, spark.previous ?? hit, point)) continue
          spark.previous = point
          const obstruction = obscuringPalm(scene.occlusion ?? [], hit.surface, point, 3)
          if (obstruction?.opacity === 0) continue
          paintSplash(ctx, visualId, point.x * sx, (point.y + scene.stageTop) * sy,
            spark.vx * sx, (spark.vy + 64*t) * sy, spark.size * 1.7,
            1-age/spark.duration, weight * (obstruction?.opacity ?? 1) * .65, t)
        }
        ctx.globalAlpha = 1
      }
      if (!relation) draw(1)
      else {
        const outline = new Path2D()
        const shape = new Path2D()
        const palm = relation.palm
        shape.ellipse(palm.center.x,palm.center.y,palm.radius.x,palm.radius.y,palm.angle,0,Math.PI*2)
        outline.addPath(shape,new DOMMatrix([sx,0,0,sy,0,scene.stageTop*sy]))
        paintShoulderEffect(ctx,outline,relation.opacity,width,height,draw)
      }
    }
    if (showPerson.checked) occludePerson(ctx, scene, sx, sy, true)
    ctx.save()
    ctx.setTransform(sx, 0, 0, sy, 0, scene.stageTop * sy)
    const mask = scene.face && facePath(scene.face.points)
    if (mask) eraseFace(ctx, mask, scene.face.margin)
    else if (scene.cameraActive) ctx.clearRect(0, 0, scene.width, scene.stageHeight)
    if ((toggles.face.checked || adaptiveDebug.mask.checked || showVisibilityFace.checked) && mask) {
      ctx.strokeStyle = '#6fead0'
      ctx.stroke(mask)
    }
    if (toggles.surface.checked || adaptiveDebug.crown.checked) {
      ctx.strokeStyle = '#ffd085'
      for (const patch of scene.patches) {
        if (!toggles.surface.checked && patch.id !== 'head') continue
        ctx.beginPath()
        for (let index = 0; index <= 40; index++) {
          const angle = index / 40 * Math.PI * 2
          const point = world(patch, { x: Math.cos(angle), y: Math.sin(angle), z: 0 })
          if (index) ctx.lineTo(point.x, point.y)
          else ctx.moveTo(point.x, point.y)
        }
        ctx.stroke()
        if (patch.crown) {
          ctx.beginPath()
          patch.crown.values.forEach((y, index) => {
            if (!Number.isFinite(y)) return
            const x = patch.crown.x + index * patch.crown.step
            ctx.moveTo(x, y)
            ctx.lineTo(x + patch.crown.step, y)
          })
          ctx.stroke()
        }
      }
    }
    if (toggles.impact.checked || visibilityPanel.open && mode === 'impact') {
      ctx.fillStyle = '#ffce7e'
      for (const hit of interaction.impacts) ctx.fillRect(hit.x - 2, hit.y - 2, 4, 4)
    }
    if (toggles.trajectory.checked) {
      ctx.strokeStyle = '#9ee9ff'
      ctx.beginPath()
      for (const drop of interaction.droplets) {
      if (drop.splash && drop.suppressSplash) continue
        ctx.moveTo(drop.position.x, drop.position.y)
        ctx.lineTo(drop.position.x - drop.velocity.x * .08, drop.position.y - drop.velocity.y * .08)
      }
      ctx.stroke()
    }
    if (regions) {
      for (const [kind, color] of [['hair', '#71e8b2'], ['face', '#b9a9ff']]) {
        if (!adaptiveDebug[kind].checked || regions.weights[kind] < .03) continue
        ctx.strokeStyle = color
        ctx.beginPath()
        for (const [a, b] of regions[kind]) {
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
        }
        ctx.stroke()
      }
      if (adaptiveDebug.events.checked) {
        for (const hit of interaction.impacts) {
          ctx.fillStyle = hit.surface === 'hair' || hit.surface === 'face' ? '#b9a9ff' : '#ffce7e'
          ctx.fillRect(hit.x - 2, hit.y - 2, 4, 4)
        }
      }
    }
    hands.draw(ctx, interaction.impacts, scene.occlusion)
    if ((mode === 'all' || mode === 'falling') && closeWeight > .001) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      for (const drop of foreground.drops) {
        drop.foregroundMix = closeWeight
        paintDrop(drop, true)
      }
      ctx.restore()
    }
    ctx.restore()
  }

  function paintDrop(drop, falling = false) {
    const radius = drop.size * params.core * (.68 + drop.depth * .64)
    const alpha = (drop.lensForeground ? closeWeight * .32 : 1) * drop.brightness * drop.life * (falling && interactive() ? drop.visibility ?? 1 : 1) * (.88 + .12 * Math.sin(drop.age * 3 + drop.phase))
    const length = Math.min(72, (drop.trailSpeed ?? drop.vy) * .117 * drop.tail * params.trail)
    if (falling && paintFalling(drop, radius, alpha, length, params, bounds)) return
    paintOriginal(drop, radius, alpha, length, params)
  }

  function tick(now) {
    const dt = previous === undefined ? 0 : Math.min(.05, (now - previous) / 1000)
    previous = now
    updateBounds()
    sampleStart ??= now
    const collisionStart = performance.now()
    scene = surface.interactionFrame(now)
    closeWeight = closeUpWeight(scene, bounds, now, dt)
    const handPatches = hands.current(now, scene, interactive())
    if (interactive()) {
      scene.occlusion = shoulderOcclusion(handPatches.filter(patch => patch.hand === 'palm'),
        scene.patches.filter(patch => patch.id.includes('shoulder')), scene.poseDepth)
      if (handPatches.length) scene.patches = [...scene.patches, ...handPatches]
      const sx = scene.width / width
      const sy = scene.height / height
      regions = updateRegions(scene, sx && sy ? { x: bounds.x * sx, y: bounds.y * sy - scene.stageTop,
        width: bounds.width * sx, height: bounds.height * sy } : null, dt, now)
      interaction.begin({ ...scene, visibleBounds: bounds, adaptive: regions, inspect: hands.inspecting ? hands.candidate : undefined }, dt)
    }
    const emission = effect.step(dt)
    canvas.style.opacity = effect.opacity
    if (effect.consumeResume()) { rain.prime(params.buildup); foreground.prime(params.buildup) }
    rain.advance(dt, params, (drop, seconds) => {
      if (response) {
        if (drop.newborn) response.generated ??= now - response.started
        if (response.generated !== undefined && drop.newborn) drop.response = response
        if (drop.response === response && drop.y >= bounds.y && drop.y <= bounds.y + bounds.height) {
          response.visible ??= now - response.started
        }
      }
      if (drop.newborn) {
        drop.visibility = 1
        drop.visuallyTerminated = false
        drop.background = drop.id % 5 === 0 && Boolean(scene.personMask)
        lastBirth = `#${drop.id} · ${drop.background ? '背景' : '前景'} · (${drop.x.toFixed(1)}, ${(drop.y - drop.vy * seconds).toFixed(1)})`
      }
      if (!interactive() || !scene.width || !scene.height) return
      if (drop.background) return
      const sx = scene.width / width
      const sy = scene.height / height
      const to = { x: drop.x * sx, y: drop.y * sy - scene.stageTop }
      const from = { x: to.x - drop.vx * seconds * sx, y: to.y - drop.vy * seconds * sy }
      if (!keepVisible(drop, scene.face, from, to)) {
        terminated++
        visibilityEvent = `#${drop.id} · 面部保护 → 轨迹结束 · (${to.x.toFixed(1)}, ${to.y.toFixed(1)})`
        return false
      }
      return interaction.advance(drop, seconds)
    }, bounds, emission)
    // This separately budgeted depth layer is born at the video top and never enters collision candidates.
    foreground.advance(dt, foregroundParams, drop => {
      drop.lensForeground = true
      if (drop.newborn && foreground.drops.length > 32) return false
    }, bounds, interactive() ? emission : 0)
    canvas.dataset.foregroundCount = foreground.drops.length
    canvas.dataset.closeWeight = closeWeight.toFixed(3)
    canvas.dataset.impacts = interactive() ? interaction.impacts.length : 0
    const renderStart = performance.now()
    paint()
    hands.report(now, fps, renderStart - collisionStart, performance.now() - renderStart, interaction.droplets, scene.occlusion)
    frameCount++
    if (now - sampleStart >= 500) {
      fps = Math.round(frameCount * 1000 / (now - sampleStart))
      frameCount = 0
      sampleStart = now
      status()
      if (visibilityPanel.open) {
        visibilityPanel.querySelector('output').textContent = `最近生成 ${lastBirth} · ${scene.personMask ? '人物分割有效' : '等待可靠分割'} · 前景结束 ${terminated} · 结束轨迹已回收\n${visibilityEvent}`
      }
      if (adaptivePanel.open) {
        const hits = interaction.impacts
        const deflections = hits.filter(hit => hit.surface === 'hair' || hit.surface === 'face').length
        const lastChange = regions ? Math.max(0, (now - regions.changedAt) / 1000).toFixed(1) : '—'
        adaptiveStatus.textContent = interactive() && regions
          ? `头顶 ${regions.crown ? '有效' : '停用'} · 顶部余量指标 ${Math.round(regions.clearance * 100)}% · 分割投影可见 ${regions.visibleRatio === null ? '未知' : Math.round(regions.visibleRatio * 100) + '%'}（采集画面外未知）
头发分割边界 ${regions.hair.length} 段 · 脸侧估计边界 ${regions.face.length} 段
有效区域 ${regions.active || '无'} · 最近变化 ${lastChange}s 前
${adaptiveDebug.weights.checked ? '混合权重 ' + Object.entries(regions.weights).map(([name, value]) => name + ' ' + value.toFixed(2)).join(' · ') + '\n' : ''}近期碰撞 ${hits.length - deflections} · 分流 ${deflections}`
          : '等待 AR 互动'
      }
    }
    frame = requestAnimationFrame(tick)
  }

  function refreshPausedFrame() {
    if (state !== 'paused') return
    const changed = updateBounds()
    if (interactive()) scene = surface.interactionFrame(performance.now())
    if (changed || interactive()) paint()
    frame = requestAnimationFrame(refreshPausedFrame)
  }

  function play() {
    if (state === 'playing') return
    cancelAnimationFrame(frame)
    state = 'playing'
    syncInteraction()
    previous = sampleStart = undefined
    frameCount = 0
    canvas.hidden = false
    frame = requestAnimationFrame(tick)
    status()
  }

  function halt(next) {
    cancelAnimationFrame(frame)
    state = next
    syncInteraction()
    fps = 0
    if (state === 'stopped') {
      hands.reset()
      rain.reset()
      foreground.reset()
      interaction.reset()
      paint()
      canvas.hidden = !toggles.bounds.checked
    } else refreshPausedFrame()
    status()
  }

  mode.onchange = () => {
    if (!interactive()) hands.reset()
    interaction.reset()
    regions = undefined
    syncInteraction()
    if (state === 'paused') {
      cancelAnimationFrame(frame)
      paint()
      refreshPausedFrame()
    }
    status()
  }
  Object.values(toggles).forEach(input => {
    input.onchange = () => {
      updateBounds()
      if (state === 'stopped') canvas.hidden = !toggles.bounds.checked
      if (state !== 'playing') paint()
    }
  })
  panel.querySelector('[data-play]').onclick = play
  panel.querySelector('[data-pause]').onclick = () => { if (state === 'playing') halt('paused') }
  panel.querySelector('[data-restart]').onclick = () => { halt('stopped'); play() }
  panel.querySelector('[data-stop]').onclick = () => halt('stopped')
  panel.querySelector('[data-stop-old]').onclick = () => { if (old.checked) old.click() }
  panel.querySelector('[data-export]').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'luminous-rain.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const observer = new ResizeObserver(() => {
    if (state === 'stopped' && toggles.bounds.checked && updateBounds()) paint()
  })
  observer.observe(video)
  observer.observe(room)
  video.addEventListener('resize', () => {
    if (state === 'stopped' && toggles.bounds.checked && updateBounds()) paint()
  })
  updateBounds()
  status()
}
