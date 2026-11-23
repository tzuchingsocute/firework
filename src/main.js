import { mountFirework } from './firework/controller.js'
import { mountVisualRain } from './rain/visual.js'
import { createExpressionPanel, expressions } from './expression/panel.js'
import { createFramingGuide } from './framing.js'
import { createSurfaceDemo } from './surface/demo.js'
import { createCollisionPreview } from './collision-preview.js'
import { createAlignmentMode } from './alignment-mode.js'
import { clearDiagnostics, recordFrame, showDiagnostics } from './diagnostics.js'
import { openCamera } from './camera.js'
import { createTracker } from './tracker.js'
import { createOverlay } from './overlay.js'

const expression = createExpressionPanel()
const video = document.querySelector('#camera')
const draw = createOverlay(document.querySelector('#landmarks'), video)
const alignment = createAlignmentMode(video)
const collision = createCollisionPreview(video)
const framing = createFramingGuide(video)
const surface = createSurfaceDemo(video, framing)
const toggle = document.querySelector('#camera-toggle')
const cameraDevice = document.querySelector('#camera-device')

async function updateCameraDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const selected = cameraDevice.value
    const options = devices.filter(device => device.kind === 'videoinput' && device.deviceId)
      .map((device, index) => new Option(device.label || `摄像头 ${index + 1}`, device.deviceId))
    cameraDevice.replaceChildren(new Option('默认摄像头', ''), ...options)
    if (options.some(option => option.value === selected)) cameraDevice.value = selected
  } catch {
    // The default camera remains available without a device list.
  }
}

updateCameraDevices()
navigator.mediaDevices?.addEventListener('devicechange', updateCameraDevices)
const showLandmarks = document.querySelector('#show-landmarks')
const fps = document.querySelector('#fps')
const face = document.querySelector('#face')
const tracking = document.querySelector('#tracking')
const message = document.querySelector('#message')

let active

function stop(session, reason = '') {
  if (active !== session) return
  active = undefined
  expression.reset(performance.now())
  session.controller.abort()
  cancelAnimationFrame(session.frame)
  if (session.videoFrame !== undefined) video.cancelVideoFrameCallback(session.videoFrame)
  session.stream?.getTracks().forEach(track => track.stop())
  session.tracker?.close()
  video.srcObject = null
  draw()
  clearDiagnostics()
  alignment.reset()
  collision.reset()
  surface.reset()
  framing.reset()
  fps.textContent = '0 FPS'
  face.textContent = '未检测到'
  tracking.textContent = reason ? '已中断' : '已停止'
  message.textContent = reason
  message.hidden = !reason
  toggle.disabled = false
  toggle.textContent = '开启摄像头'
  cameraDevice.disabled = false
}

function track(session) {
  let lastVideoTime = -1
  let sampleStart = performance.now()
  let frames = 0
  let renders = 0
  let captureInterval = 0
  let lastCapture
  let cadenceSource = ''
  if (video.requestVideoFrameCallback) {
    const sampleVideo = (_now, metadata) => {
      if (active !== session) return
      const source = Number.isFinite(metadata.captureTime) ? '采集时间' : '视频时间戳'
      const timestamp = source === '采集时间' ? metadata.captureTime : metadata.mediaTime * 1000
      if (lastCapture !== undefined && cadenceSource === source && timestamp > lastCapture) {
        const interval = timestamp - lastCapture
        captureInterval = captureInterval ? captureInterval * .8 + interval * .2 : interval
      }
      lastCapture = timestamp
      cadenceSource = source
      session.videoFrame = video.requestVideoFrameCallback(sampleVideo)
    }
    session.videoFrame = video.requestVideoFrameCallback(sampleVideo)
  }

  function update(now) {
    if (active !== session) return
    try {
      const renderTime = performance.now()
      renders++
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime
        const frozen = alignment.capture()
        const started = performance.now()
        const result = session.tracker.detectForVideo(frozen ?? video, started)
        const inferenceMs = performance.now() - started
        expression.update(result, started, Boolean(frozen))
        const points = result.faceLandmarks[0]
        framing.update(started)
        draw(showLandmarks.checked || alignment.enabled ? points : undefined)
        alignment.update(points, frozen)
        if (surface.active || framing.reframing) collision.reset()
        else collision.update(points, started, framing.frame)
        surface.update(points)
        firework.updateFace(points)
        const faceLabel = points ? '已检测到' : '未检测到'
        const trackingLabel = points ? '追踪中' : '正在寻找人脸'
        if (face.textContent !== faceLabel) face.textContent = faceLabel
        if (tracking.textContent !== trackingLabel) tracking.textContent = trackingLabel
        recordFrame(video, points, started, inferenceMs)
        frames++
      }
      if (now - sampleStart >= 750) {
        framing.cadence(Math.round(renders * 1000 / (now - sampleStart)), captureInterval, cadenceSource)
        renders = 0
        fps.textContent = `${Math.round(frames * 1000 / (now - sampleStart))} FPS`
        frames = 0
        sampleStart = now
      }
      expression.render(renderTime)
      collision.render(renderTime)
      surface.render(performance.now())
      showDiagnostics(renderTime)
      session.frame = requestAnimationFrame(update)
    } catch (error) {
      console.error(error)
      stop(session, '人脸追踪中断，请重新开启摄像头。')
    }
  }
  session.frame = requestAnimationFrame(update)
}

toggle.addEventListener('click', async () => {
  if (active) {
    stop(active)
    return
  }

  const session = { controller: new AbortController() }
  active = session
  toggle.disabled = true
  cameraDevice.disabled = true
  message.hidden = true
  tracking.textContent = '等待摄像头权限'
  let failureMessage
  try {
    session.stream = await openCamera(video, session.controller.signal, () => {
      stop(session, '摄像头已断开，请重试。')
    }, cameraDevice.value)
    updateCameraDevices()
    if (active !== session) {
      session.stream.getTracks().forEach(track => track.stop())
      return
    }
    tracking.textContent = '加载人脸模型'
    failureMessage = '人脸模型加载失败。请检查网络后重新开启摄像头。'
    const tracker = await createTracker()
    if (active !== session) {
      tracker.close()
      return
    }
    session.tracker = tracker
    tracking.textContent = '正在寻找人脸'
    toggle.textContent = '关闭摄像头'
    toggle.disabled = false
    track(session)
  } catch (error) {
    console.error(error)
    stop(session, failureMessage ?? error.message)
  }
})

showLandmarks.addEventListener('change', () => {
  if (!showLandmarks.checked) draw()
})
window.addEventListener('pagehide', () => {
  if (active) stop(active)
})

// The first click can only occur once the camera handler is installed.
toggle.disabled = false

const controlsToggle = document.querySelector('#controls-toggle')
const controlsContent = document.querySelector('#controls-content')
controlsToggle.addEventListener('click', () => {
  const collapsed = !controlsContent.hidden
  controlsContent.hidden = collapsed
  controlsToggle.setAttribute('aria-expanded', String(!collapsed))
  controlsToggle.setAttribute('aria-label', collapsed ? '展开控制面板' : '收起控制面板')
  controlsToggle.textContent = collapsed ? 'Debug ⌄' : '收起 ⌃'
})

const firework = mountFirework(expressions)
mountVisualRain(surface, expressions, firework)
