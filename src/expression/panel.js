import { ExpressionManager, readScores, calibrate, defaults, withSensitivity, tuneSmile, recalibrateSmile } from './manager.js'
export const expressions = new ExpressionManager()

export function createExpressionPanel() {
  const panel = document.querySelector('#expression-panel')
  const state = panel.querySelector('output')
  const message = panel.querySelector('[role=status]')
  const plot = panel.querySelector('canvas')
  const context = plot.getContext('2d')
  const buttons = [...panel.querySelectorAll('[data-calibrate]')]
  const explanation = panel.querySelector('[data-explain]')
  const configInput = panel.querySelector('[data-expression-config]')
  const sensitivity = panel.querySelector('[data-smile-sensitivity]')
  const mild = panel.querySelector('[data-mild-sensitivity]')
  const progress = panel.querySelector('[data-calibration-progress]')
  const detail = panel.querySelector('[data-calibration-detail]')
  const stages = ['NEUTRAL', 'SMILE', 'LAUGH']
  const guidance = {
    NEUTRAL: '保持自然表情',
    SMILE: '自然地微笑，不需要刻意用力',
    LAUGH: '试着笑得更开心一些，像看到一件让你很高兴的事情。可以闭嘴',
  }
  let baseConfig = defaults
  function apply(config) {
    const nextConfig = tuneSmile(withSensitivity(config, sensitivity.value), mild.value)
    baseConfig = config
    expressions.thresholds = nextConfig
    configInput.value = JSON.stringify(baseConfig, null, 2)
  }
  apply(baseConfig)
  sensitivity.onchange = mild.onchange = () => apply(baseConfig)
  panel.querySelector('[data-apply-config]').onclick = () => {
    try {
      if (capturing) throw new Error('请先完成或重置校准')
      const { calibration, ...edited } = JSON.parse(configInput.value)
      apply(edited)
      message.textContent = '已应用手动参数'
    } catch (error) { message.textContent = error.message }
  }
  let samples = {}
  let capturing
  let timer
  let history = []
  let lastDraw = 0
  let next = 0
  function controls() {
    buttons.forEach((button, index) => { button.disabled = Boolean(capturing) || (index !== Math.min(next, 2) && !(next === 3 && index === 1)) })
  }
  panel.querySelector('[data-reset]').onclick = () => {
    clearTimeout(timer)
    capturing = undefined
    samples = {}
    next = 0
    sensitivity.value = mild.value = 'balanced'
    apply(defaults)
    progress.value = 0
    detail.textContent = '采集时会显示强度与有效帧数。'
    expressions.lose(performance.now())
    message.textContent = '已恢复默认参数，可以重新校准'
    controls()
  }
  buttons.forEach(button => {
    button.onclick = () => {
      if (!expressions.snapshot.faceDetected) { message.textContent = '请先开启摄像头并让脸部入镜'; return }
      capturing = button.dataset.calibrate
      samples[capturing] = []
      progress.value = 0
      message.textContent = guidance[capturing] + ' · 约 2 秒'
      controls()
      timer = setTimeout(() => {
        const stage = capturing
        const rows = samples[stage]
        capturing = undefined
        if (rows.length < 20 || rows.at(-1).time - rows[0].time < 1900) {
          message.textContent = '有效帧不足，请重采当前步骤'
        } else if (stage !== 'LAUGH' && !stages.every(name => samples[name]?.length >= 20)) {
          next = stages.indexOf(stage) + 1
          message.textContent = '采集完成，请进行下一步'
        } else {
          try {
            if (stage === 'SMILE' && next === 3) {
              apply(recalibrateSmile(rows, baseConfig))
              detail.textContent = `轻微微笑样本中位数 ${baseConfig.smileSample.median.toFixed(3)}`
              message.textContent = '微笑阈值已更新，强笑校准已保留'
              controls()
              return
            }
            const result = calibrate(samples, baseConfig)
            apply(result)
            next = 3
            const { reliable, overlapping, gap } = result.calibration
            detail.textContent = `强笑与微笑中位数差 ${gap.toFixed(3)} · ${reliable ? overlapping ? '部分重叠，已校准' : '区分度足够' : '区分度低，已应用保守阈值'}`
            message.textContent = reliable
              ? '实时验证：自然表情 → 微笑 → 灿烂笑容 → 微笑 → 自然表情。可单独重采强笑。'
              : '两次笑容强度接近，可继续体验、调整灵敏度，或只重采强笑。'
          } catch (error) {
            if (error.stage) next = stages.indexOf(error.stage)
            message.textContent = error.message
          }
        }
        controls()
      }, 2100)
    }
  })
  controls()
  return {
    update(result, now, frozen) {
      const categories = result.faceBlendshapes?.[0]?.categories
      const raw = !frozen && result.faceLandmarks?.length && readScores(categories)
      expressions.update(categories, Boolean(raw), now)
      if (capturing) {
        if (!raw) {
          clearTimeout(timer); capturing = undefined
          message.textContent = '追踪丢失或画面暂停，本次采集无效，请重试'
          controls()
        } else {
          const rows = samples[capturing]
          rows.push({ ...raw, time: now })
          progress.value = now - rows[0].time
          detail.textContent = `${guidance[capturing]} · 有效 ${rows.length} 帧 · 当前绝对强度 ${raw.absoluteIntensity.toFixed(3)}`
        }
      }
      history.push(structuredClone(expressions.snapshot))
      history = history.slice(-180)
    },
    render(now) {
      expressions.expire(now)
      if (!panel.open || now - lastDraw < 100) return
      lastDraw = now
      const value = expressions.snapshot
      state.dataset.state = value.state
      state.textContent = `${value.state} · Smile ${value.smileScore.toFixed(3)} · Jaw ${value.jawOpenScore.toFixed(3)} · Laugh ${value.laughScore.toFixed(3)}
Intensity ${value.smileIntensity.toFixed(3)}（个人校准后） · 绝对 ${value.absoluteIntensity.toFixed(3)} · Mouth ${value.mouthSmileScore.toFixed(3)}
Cheek ${value.cheekScore.toFixed(3)} · Eye ${value.eyeSquintScore.toFixed(3)}
持续 ${((now - expressions.changedAt) / 1000).toFixed(1)}s · 最近切换 ${expressions.changedAt.toFixed(0)}ms
原始嘴角 ${(expressions.rawSmile ?? 0).toFixed(3)} · 微笑进入 ${expressions.thresholds.smileEnter.toFixed(3)} / 退出 ${expressions.thresholds.smileExit.toFixed(3)}
保持进度 ${Math.round((expressions.holdProgress ?? 0) * 100)}% · ${expressions.pending?.state ?? '无待切换状态'} · 最近切换 ${expressions.transitionReason ?? '—'}`
      explanation.textContent = `嘴角贡献 ${value.contributions.mouth.toFixed(3)} · 脸颊贡献 ${value.contributions.cheek.toFixed(3)} · 眼部贡献 ${value.contributions.eye.toFixed(3)} · 张嘴贡献 ${value.contributions.jaw.toFixed(3)}
${value.state === 'LAUGH' ? '强烈笑容强度已持续达到高阈值；嘴角是核心证据，张嘴贡献可以为零。' : '持续高强度笑容可进入 LAUGH。单纯张嘴或眯眼缺少嘴角支持。'}`
      context.clearRect(0, 0, plot.width, plot.height)
      for (const [key, color] of [['mouthSmileScore', '#60eac4'], ['cheekScore', '#ffa166'], ['eyeSquintScore', '#7db6ff'], ['jawOpenScore', '#ffd166'], ['smileIntensity', '#e88cff']]) {
        context.strokeStyle = color
        context.beginPath()
        history.forEach((row, index) => {
          const x = (row.timestamp - now + 6000) / 6000 * plot.width
          const y = (1 - row[key]) * plot.height
          if (index) context.lineTo(x, y); else context.moveTo(x, y)
        })
        context.stroke()
      }
    },
    reset(now) {
      expressions.lose(now)
      clearTimeout(timer)
      if (capturing) message.textContent = '摄像头已停止，当前采集无效'
      capturing = undefined
      history = []
      state.textContent = 'NO_FACE · 摄像头已停止'
      state.dataset.state = 'NO_FACE'
      context.clearRect(0, 0, plot.width, plot.height)
      controls()
    },
  }
}
