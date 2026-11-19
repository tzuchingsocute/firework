const debug = document.querySelector('#debug')
const output = document.querySelector('#coordinates')
let details = ''
let lastRender = 0

debug.addEventListener('change', () => {
  output.hidden = !debug.checked
  if (!output.hidden) output.textContent = details || '等待视频帧'
})

export function recordFrame(video, points, time, inferenceMs) {
  const sink = window.__stage1Diagnostics
  const nose = points?.[1]
  if (debug.checked) {
    details = nose
      ? `${points.length} 点 · 鼻尖 x=${nose.x.toFixed(3)} y=${nose.y.toFixed(3)} · ${inferenceMs.toFixed(1)} ms`
      : '未检测到人脸'
  }
  if (sink) {
    sink({ time, videoTime: video.currentTime, width: video.videoWidth,
      height: video.videoHeight, inferenceMs, points })
  }
}

export function showDiagnostics(now) {
  window.__stage1Render?.(now)
  if (debug.checked && now - lastRender > 250) {
    output.textContent = details
    lastRender = now
  }
}

export function clearDiagnostics() {
  details = '等待视频帧'
  output.textContent = details
}
