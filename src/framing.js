import { projectPoints, videoFit, videoGeometry } from './projection.js'

const portraitAspect = 414 / 896

export const framingTargets = {
  headHeight: [.35, .50], headroom: [.10, .20], center: [.40, .60],
  limitHeight: .68, limitCenter: [.24, .76], edge: .018, minimumHead: .13,
}

export function judgeFraming(sample, previous, target = framingTargets) {
  const { top, bottom, left, right, shoulders, torso, confidence, sourceClipped } = sample
  if (top <= target.edge || sourceClipped === 'top') return ['Invalid', '请调整距离或镜头角度，让头顶完整入镜']
  const size = bottom - top
  const center = (left + right) / 2
  const slack = previous === 'Invalid' ? 0 : .025
  if (size > target.limitHeight + slack) return ['Invalid', '请稍微远离摄像头']
  if (left <= 0 || right >= 1 || bottom >= 1 || sourceClipped) return ['Invalid', '请调整位置，让整个头部入镜']
  if (center < target.limitCenter[0] - slack) return ['Invalid', '请稍微向右移动']
  if (center > target.limitCenter[1] + slack) return ['Invalid', '请稍微向左移动']
  if (!shoulders || !torso) return ['Invalid', '请调整位置，露出双肩和部分上半身']
  if (size < target.minimumHead) return ['Invalid', '请稍微靠近摄像头']
  const within = (value, [min, max]) => value >= min && value <= max
  if (confidence === 'high' && within(size, target.headHeight) && within(top, target.headroom) && within(center, target.center)) {
    return ['Ideal', '构图已就绪，可以开始互动']
  }
  return ['Acceptable', size < target.headHeight[0] ? '可稍微靠近摄像头'
    : size > target.headHeight[1] ? '可稍微远离摄像头' : top < target.headroom[0] ? '可多留一点头顶空间' : '可以开始互动']
}

export function createFramingState() {
  let state = 'Invalid'
  let message = '请让头部与双肩进入画面'
  let candidate
  let since = 0
  let entered = 0
  return (next, now) => {
    const key = next.join('|')
    if (candidate !== key) { candidate = key; since = now }
    const duration = next[0] === 'Invalid' && state !== 'Invalid' ? 1600 : 450
    if (now - since >= duration && (state !== next[0] || message !== next[1])) {
      state = next[0]
      message = next[1]
      entered = now
    }
    return { state, message: state === 'Ideal' && now - entered > 1600 ? '' : message }
  }
}

export function framingSample(frame, width, height) {
  if (!frame.pose?.[0] || !width || !height) return null
  const pose = projectPoints(frame.pose, width, height, frame.videoWidth, frame.videoHeight, frame.mode)
  const shoulderWidth = Math.hypot(pose[11].x - pose[12].x, pose[11].y - pose[12].y)
  if (shoulderWidth < 8) return null
  const geo = videoGeometry(width, height, frame.videoWidth, frame.videoHeight, frame.mode)
  const content = { x: Math.max(0, geo.x), y: Math.max(0, geo.y),
    width: Math.min(width, geo.imageWidth), height: Math.min(height, geo.imageHeight) }
  const bounds = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity }
  let hair = 0
  let face = 0
  let torso = 0
  let sourceClipped
  const shouldersY = (pose[11].y + pose[12].y) / 2
  const shouldersX = (pose[11].x + pose[12].x) / 2
  for (let row = 0; row < frame.maskHeight; row++) {
    const y = geo.y + (row + .5) * geo.imageHeight / frame.maskHeight
    for (let col = 0; col < frame.maskWidth; col++) {
      const x = geo.x + (1 - (col + .5) / frame.maskWidth) * geo.imageWidth
      const label = frame.mask[row * frame.maskWidth + col]
      if ((label === 2 || label === 4) && Math.abs(x - shouldersX) < shoulderWidth * .35
        && y > shouldersY + shoulderWidth * .08 && y < Math.min(height, shouldersY + shoulderWidth * .5)) torso++
      if ((label !== 1 && label !== 3) || y > shouldersY || Math.hypot(x - pose[0].x, y - pose[0].y) > shoulderWidth * 1.05) continue
      if (label === 1) hair++
      else face++
      if (row < 2) sourceClipped = 'top'
      else if (sourceClipped !== 'top' && (col < 2 || col >= frame.maskWidth - 2)) sourceClipped = 'side'
      bounds.top = Math.min(bounds.top, (y - content.y) / content.height)
      bounds.bottom = Math.max(bounds.bottom, (y - content.y) / content.height)
      bounds.left = Math.min(bounds.left, (x - content.x) / content.width)
      bounds.right = Math.max(bounds.right, (x - content.x) / content.width)
    }
  }
  if (face < 8) return null
  const chin = frame.chin && projectPoints([frame.chin], width, height, frame.videoWidth, frame.videoHeight, frame.mode)[0]
  if (chin) bounds.bottom = Math.max(bounds.bottom, (chin.y - content.y) / content.height)
  if (chin?.y >= geo.y + geo.imageHeight - 2) sourceClipped ??= 'bottom'
  const shoulders = [11, 12].every(i => frame.pose[i].visibility > .5
    && frame.pose[i].x > .02 && frame.pose[i].x < .98 && frame.pose[i].y > .02 && frame.pose[i].y < .98
    && pose[i].x > 4 && pose[i].x < width - 4 && pose[i].y > 4 && pose[i].y < height - 4)
  return { ...bounds, shoulders, torso: torso >= 6, confidence: hair >= 12 && chin ? 'high' : 'low', sourceClipped }
}

export function safePortraitCrop(frame, current = 'contain') {
  if (!frame || frame.videoWidth / frame.videoHeight <= portraitAspect) return 'contain'
  const source = framingSample({ ...frame, mode: 'contain' }, frame.videoWidth, frame.videoHeight)
  if (!source || source.confidence !== 'high' || source.sourceClipped || !source.shoulders || !source.torso
      || source.bottom - source.top > framingTargets.limitHeight) return 'contain'
  const cropWidth = portraitAspect * frame.videoHeight / frame.videoWidth
  // Base the safety margin on shoulder width rather than the entire source.
  const shoulderSpan = Math.abs(frame.pose[11].x - frame.pose[12].x)
  const margin = Math.min(.035, shoulderSpan * .12)
  const left = Math.min(1 - source.right, frame.pose[11].x, frame.pose[12].x) - margin
  const right = Math.max(1 - source.left, frame.pose[11].x, frame.pose[12].x) + margin
  if (left < 0 || right > 1 || right - left > cropWidth) return 'contain'
  const clamp = anchor => Math.max(cropWidth / 2, Math.min(1 - cropWidth / 2, anchor))
  const anchor = Number(current.split(':')[1])
  const previous = clamp(anchor)
  if (Number.isFinite(anchor) && previous - cropWidth / 2 <= left && previous + cropWidth / 2 >= right) return current
  return `cover:${clamp((left + right) / 2)}`
}

const landscapeTargets = { ...framingTargets, headroom: [0, .35], headHeight: [.18, .58], minimumHead: .10 }

export function createFramingGuide(video) {
  const guide = document.querySelector('#framing-guide')
  const output = document.querySelector('#framing-message')
  const panel = document.querySelector('#camera-debug')
  const formatSelect = document.querySelector('#broadcast-format')
  const room = video.closest('.live-room')
  const reframe = document.querySelector('#reframe-camera')
  let requestedAt
  let sourceSize
  let renderFps = 0
  let captureMs = 0
  let cadenceSource = ''
  reframe.onclick = () => {
    requestedAt = performance.now()
    reframe.disabled = true
  }
  formatSelect.onchange = () => {
    room.dataset.format = formatSelect.value
    video.dataset.fit = formatSelect.value === 'landscape' ? 'contain' : 'cover'
    video.style.objectPosition = '50% 50%'
    reset()
  }
  let advance = createFramingState()
  let cachedFit = 'cover'
  let cachedGeometry
  let frameData
  let sample
  let lastSample = -Infinity
  let current = 'Invalid'
  function reset() {
    advance = createFramingState()
    cachedFit = formatSelect.value === 'landscape' ? 'contain' : 'cover'
    requestedAt = undefined
    sourceSize = undefined
    reframe.disabled = true
    video.dataset.fit = cachedFit
    video.style.objectPosition = '50% 50%'
    frameData = undefined
    cachedGeometry = undefined
    sample = undefined
    lastSample = -Infinity
    current = 'Invalid'
    guide.hidden = true
    output.textContent = ''
    panel.textContent = ''
  }
  return {
    reset,
    cadence(fps, interval, source) {
      renderFps = fps
      captureMs = interval
      cadenceSource = source
    },
    get reframing() { return requestedAt !== undefined },
    accept(frame, width, height) {
      frameData = frame
      if (requestedAt !== undefined && frame.time >= requestedAt) {
        const next = safePortraitCrop(frame)
        if (next !== 'contain') {
          cachedFit = next
          requestedAt = undefined
        }
      }
      sample = framingSample({ ...frame, mode: cachedFit }, width, height)
      cachedGeometry = `${width}:${height}:${formatSelect.value === 'landscape'}`
      lastSample = performance.now()
    },
    update(now) {
      if (!video.videoWidth || !video.videoHeight) return
      const dimensions = `${video.videoWidth}×${video.videoHeight}`
      if (sourceSize && sourceSize !== dimensions) reset()
      sourceSize = dimensions
      const landscape = formatSelect.value === 'landscape'
      if (landscape) {
        const ratio = video.videoWidth / video.videoHeight
        room.style.setProperty('--landscape-video-ratio', String(ratio > 1 ? ratio : 16 / 9))
      }
      const rect = video.getBoundingClientRect()
      const sourceFrame = now - lastSample < 750 ? frameData : undefined
      if (requestedAt !== undefined && now - requestedAt > 2500) requestedAt = undefined
      reframe.disabled = landscape || requestedAt !== undefined || video.videoWidth / video.videoHeight <= portraitAspect
      const fit = cachedFit
      if (video.dataset.fit !== fit) video.dataset.fit = fit
      const geo = videoGeometry(rect.width, rect.height, video.videoWidth, video.videoHeight, fit)
      const spare = geo.imageWidth - rect.width
      const position = `${spare > 0 ? (1 + geo.x / spare) * 100 : 50}% 50%`
      if (video.style.objectPosition !== position) video.style.objectPosition = position
      const presentation = landscape ? 'Landscape Contain'
        : geo.cropX > .001 || geo.cropY > .001 ? 'Locked Crop' : 'Native Portrait'
      const settings = video.srcObject?.getVideoTracks()[0]?.getSettings() ?? {}
      const key = `${rect.width}:${rect.height}:${landscape}`
      if (cachedGeometry !== key) {
        sample = sourceFrame ? framingSample({ ...sourceFrame, mode: fit }, rect.width, rect.height) : null
        cachedGeometry = key
      }
      const usable = sourceFrame ? sample : null
      const verdict = usable ? judgeFraming(usable, current, landscape ? landscapeTargets : framingTargets)
        : ['Invalid', '请让头部与双肩进入画面']
      const result = advance(verdict, now)
      current = result.state
      guide.hidden = false
      guide.dataset.state = current
      const message = requestedAt !== undefined ? '正在重新取景，请让头顶与双肩入镜' : result.message
      if (output.textContent !== message) output.textContent = message
      if (panel.closest('details').open) panel.textContent = [
        `模式 ${landscape ? 'Landscape' : 'Portrait'} · ${presentation} · ${requestedAt === undefined ? '裁切已锁定' : '重新取景中'}`,
        `渲染 ${renderFps || '—'} FPS · 视频帧间隔 ${captureMs ? captureMs.toFixed(1) + ' ms' : '—'} ${cadenceSource}`,
        `实际视频 ${Math.round(Math.min(rect.width, geo.imageWidth))}×${Math.round(Math.min(rect.height, geo.imageHeight))} CSS px · 宽高比 ${(Math.min(rect.width, geo.imageWidth) / Math.min(rect.height, geo.imageHeight)).toFixed(3)}`,
        `入镜 ${usable ? usable.shoulders && usable.torso && !usable.sourceClipped ? '头部、双肩与上半身可用' : '取景受限' : '待检测'}`,
        '请求 前置摄像头优先 · 720×1280 · 9:16（理想值）',
        `设备 ${settings.deviceId ? '…' + settings.deviceId.slice(-4) : '未公开'} · ${settings.facingMode ?? '方向未公开'}`,
        `原始 ${video.videoWidth}×${video.videoHeight} · 宽高比 ${(video.videoWidth / video.videoHeight).toFixed(3)}`,
        `轨道 ${settings.width ?? '—'}×${settings.height ?? '—'} · 宽高比 ${settings.aspectRatio ?? '—'} · zoom ${settings.zoom ?? '未公开'}`,
        `容器 ${Math.round(rect.width)}×${Math.round(rect.height)} CSS px · ${fit} · 镜像 · ${landscape ? '横屏视频' : '竖屏视频'} · 直播间基准 414×896`,
        `显示缩放 ${geo.scale.toFixed(3)}× · 横裁 ${(geo.cropX * 100).toFixed(1)}% · 纵裁 ${(geo.cropY * 100).toFixed(1)}%`,
        `源范围 X ${Math.max(0, (1 - (rect.width - geo.x) / geo.imageWidth) * 100).toFixed(1)}–${Math.min(100, (1 + geo.x / geo.imageWidth) * 100).toFixed(1)}% · 偏移 ${geo.x.toFixed(1)}, ${geo.y.toFixed(1)} px`,
        `构图 ${current} · 头部边界置信度 ${usable?.confidence ?? '待检测'}`,
        usable ? `头高 ${((usable.bottom - usable.top) * 100).toFixed(1)}% · 顶部留白 ${(usable.top * 100).toFixed(1)}% · 水平中心 ${((usable.left + usable.right) * 50).toFixed(1)}%` : '',

      ].join('\n')
    },
    get frame() { return performance.now() - lastSample < 350 ? frameData : undefined },
    get ready() { return current !== 'Invalid' },
    get state() { return current },
  }
}
