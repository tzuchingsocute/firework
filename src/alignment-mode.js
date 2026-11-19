import { anchors, measureSample, scenes, summarizeSamples } from './alignment-metrics.js'
import { projectPoints, videoFit, videoGeometry } from './projection.js'
import { contours } from './tracker.js'

export function createAlignmentMode(video) {
  const el = id => document.getElementById(id)
  const debug = el('debug')
  const tools = el('alignment-tools')
  const freeze = el('alignment-freeze')
  const dialog = el('alignment-dialog')
  const scene = el('alignment-scene')
  const zoom = el('alignment-zoom')
  const scroll = el('alignment-scroll')
  const canvas = el('alignment-canvas')
  const ctx = canvas.getContext('2d')
  const pan = el('alignment-pan')
  const prediction = el('alignment-prediction')
  const indices = el('alignment-indices')
  const real = el('alignment-real')
  const save = el('alignment-save')
  const download = el('alignment-export')
  const result = el('alignment-result')
  const progress = el('alignment-progress')
  const samples = {}
  let pending = false
  let frame
  let points
  let draft
  let active = anchors[0].id
  let dragging

  const pct = value => `${(value * 100).toFixed(2)}%`
  const stats = measured => `平均 ${pct(measured.mean)} · P95 ${pct(measured.p95)} · 最大 ${pct(measured.max)} · 方向偏差 ${pct(measured.offset)} · 左右顺序 ${measured.sidesCorrect ? '正确' : '异常'}`
  for (const [id, label] of Object.entries(scenes)) scene.add(new Option(label, id))
  const labels = new Map(anchors.map(({ id, label }) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.onclick = () => { active = id; render() }
    el('alignment-labels').append(button)
    return [id, button]
  }))

  function render() {
    if (!draft) return
    const { width, height, reference, predicted } = draft
    const scale = Number(zoom.value)
    canvas.style.width = `${width * scale}px`
    canvas.style.height = `${height * scale}px`
    const density = Math.min(Math.max(2, window.devicePixelRatio) * scale, 2048 / Math.max(width, height))
    const pixelWidth = Math.round(width * density)
    const pixelHeight = Math.round(height * density)
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight
    ctx.setTransform(density, 0, 0, density, 0, 0)
    const geometry = videoGeometry(width, height, frame.width, frame.height, videoFit(video))
    ctx.save()
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(frame, width - geometry.x - geometry.imageWidth, geometry.y,
      geometry.imageWidth, geometry.imageHeight)
    ctx.restore()
    if (prediction.checked) {
      ctx.beginPath()
      for (const { start, end } of contours) {
        ctx.moveTo(points[start].x, points[start].y)
        ctx.lineTo(points[end].x, points[end].y)
      }
      for (const path of [[168, 6, 197, 195, 5, 4, 1, 2], [98, 97, 2, 326, 327]]) {
        ctx.moveTo(points[path[0]].x, points[path[0]].y)
        for (const index of path.slice(1)) ctx.lineTo(points[index].x, points[index].y)
      }
      ctx.strokeStyle = '#65fff3'
      ctx.stroke()
      ctx.fillStyle = '#dafffb'
      for (const point of points) ctx.fillRect(point.x - .6, point.y - .6, 1.2, 1.2)
    }
    for (const { id, index } of anchors) {
      if (prediction.checked && indices.checked) {
        ctx.fillStyle = '#65fff3'
        ctx.font = '10px monospace'
        ctx.fillText(String(index), predicted[id].x + 4, predicted[id].y - 4)
      }
      const point = reference[id]
      if (point) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, id === active ? 4 : 3, 0, 2 * Math.PI)
        ctx.fillStyle = '#ffca67'
        ctx.fill()
      }
      labels.get(id).setAttribute('aria-pressed', String(id === active))
    }

    let measured
    try { measured = measureSample(draft) } catch (error) { result.textContent = error.message }
    if (measured) {
      result.textContent = `双眼外眼角间距 ${measured.eyeDistance.toFixed(1)} px。打开预测可查看误差。`
      if (prediction.checked) result.textContent = [
        `归一化基准 · 人工标注双眼外眼角间距 ${measured.eyeDistance.toFixed(1)} px`,
        ...measured.errors.map(error => `${error.label} #${error.index} · 预测 (${predicted[error.id].x.toFixed(1)}, ${predicted[error.id].y.toFixed(1)}) px · 标注 (${reference[error.id].x.toFixed(1)}, ${reference[error.id].y.toFixed(1)}) px · 距离 ${error.pixels.toFixed(1)} px / ${pct(error.normalized)}`),
        stats(measured),
      ].join('\n')
    }
    save.disabled = !measured || !real.checked
  }

  function updateProgress() {
    const summary = summarizeSamples(samples)
    const rows = Object.entries(scenes).map(([id, label]) => {
      const li = document.createElement('li')
      const measured = summary?.scenes.find(entry => entry.scene === id)
      li.textContent = `${label} · ${measured ? stats(measured) : '待采集'}`
      return li
    })
    const total = document.createElement('li')
    total.textContent = summary ? `已保存 ${summary.scenes.length}/6 · ${stats(summary)} · ${summary.complete ? (summary.pass ? '达到 Demo 目标' : '未达到 Demo 目标') : 'BLOCKED / 未验证'}` : '真人对齐精度 · BLOCKED / 未验证'
    progress.replaceChildren(total, ...rows)
    download.disabled = !summary
  }

  function location(event) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(draft.width, (event.clientX - rect.left) * draft.width / rect.width)),
      y: Math.max(0, Math.min(draft.height, (event.clientY - rect.top) * draft.height / rect.height)),
    }
  }
  canvas.onpointerdown = event => {
    if (!draft || pan.checked || event.button !== 0) return
    const point = location(event)
    const existing = Object.entries(draft.reference).find(([, mark]) => Math.hypot(mark.x - point.x, mark.y - point.y) <= 12 / Number(zoom.value))
    dragging = existing?.[0] ?? active
    active = dragging
    draft.reference[dragging] = point
    canvas.setPointerCapture(event.pointerId)
    render()
  }
  canvas.onpointermove = event => {
    if (!draft) return
    const point = location(event)
    el('alignment-cursor').textContent = `画面坐标 x ${point.x.toFixed(1)} px · y ${point.y.toFixed(1)} px`
    if (dragging && canvas.hasPointerCapture(event.pointerId)) {
      draft.reference[dragging] = point
      render()
    }
  }
  canvas.onlostpointercapture = () => { dragging = undefined }
  pan.onchange = () => { canvas.style.touchAction = pan.checked ? 'pan-x pan-y' : 'none' }
  for (const control of [prediction, indices, real]) control.onchange = render
  zoom.oninput = () => {
    const oldWidth = canvas.clientWidth
    const oldHeight = canvas.clientHeight
    const x = (scroll.scrollLeft + scroll.clientWidth / 2) / oldWidth
    const y = (scroll.scrollTop + scroll.clientHeight / 2) / oldHeight
    render()
    scroll.scrollLeft = x * canvas.clientWidth - scroll.clientWidth / 2
    scroll.scrollTop = y * canvas.clientHeight - scroll.clientHeight / 2
  }
  debug.addEventListener('change', () => {
    tools.hidden = !debug.checked
    if (!debug.checked) pending = false
  })
  freeze.onclick = () => { pending = true; freeze.disabled = true }
  el('alignment-close').onclick = () => dialog.close()
  dialog.onclose = () => {
    frame = points = draft = dragging = undefined
    if (video.srcObject) video.play().catch(console.error)
  }
  save.onclick = () => {
    if (!draft || !real.checked) return
    try { measureSample(draft) } catch { return }
    if (Object.entries(samples).some(([id, sample]) => id !== scene.value && sample.capturedAt === draft.capturedAt)) {
      result.textContent = '这个冻结帧已经用于其他场景，请返回实时画面重新采集。'
      return
    }
    samples[scene.value] = { ...structuredClone(draft), input: 'real-camera', annotation: 'manual' }
    updateProgress()
  }
  download.onclick = () => {
    const data = { version: 1, coordinateSpace: 'mirrored-stage-css-pixels',
      samples, summary: summarizeSamples(samples) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'face-alignment.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  updateProgress()

  return {
    get enabled() { return debug.checked },
    capture() {
      if (!pending) return
      pending = false
      const image = document.createElement('canvas')
      image.width = video.videoWidth
      image.height = video.videoHeight
      image.getContext('2d').drawImage(video, 0, 0)
      return image
    },
    update(landmarks, frozen) {
      if (!debug.checked) return
      freeze.disabled = !landmarks
      if (!frozen) return
      if (!landmarks) {
        el('coordinates').textContent = '冻结帧未检测到人脸，请重新采样。'
        return
      }
      const { width, height } = video.getBoundingClientRect()
      points = projectPoints(landmarks, width, height, frozen.width, frozen.height, videoFit(video))
      const predicted = Object.fromEntries(anchors.map(({ id, index }) => [id, points[index]]))
      frame = frozen
      draft = { width, height, predicted, reference: {}, capturedAt: new Date().toISOString() }
      active = anchors[0].id
      zoom.value = 1
      pan.checked = prediction.checked = indices.checked = real.checked = false
      pan.onchange()
      video.pause()
      dialog.showModal()
      render()
      scroll.scrollLeft = scroll.scrollTop = 0
    },
    reset() {
      pending = false
      freeze.disabled = true
      if (dialog.open) dialog.close()
    },
  }
}
