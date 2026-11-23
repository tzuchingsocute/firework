export function createEffectController(
  expressions,
  start,
  now = () => performance.now(),
  firework,
) {
  let mode = 'manual'
  let state = expressions?.snapshot.state ?? 'NO_FACE'
  let intensity = 0
  let eventName = '—'
  let eventAt
  let latency
  let hold = 0
  let opacity = 1
  let transitioning = false
  let wasPlaying = false
  let resumed = false
  const events = [
    'smile:start',
    'smile:end',
    'laugh:start',
    'laugh:end',
    'face:lost',
    'face:recovered',
  ]
  for (const event of events)
    expressions?.addEventListener('expression:' + event, ({ detail }) => {
      const wasSmile = state === 'SMILE'
      const wasLaugh = state === 'LAUGH'
      state = detail.state
      eventName = event
      if (wasSmile && state !== 'SMILE') hold = state === 'NO_FACE' ? 0 : 0.12
      if (state === 'NO_FACE') {
        intensity = 0
        hold = 0
      }
      if (state === 'LAUGH' && !wasLaugh && mode === 'expression' && firework)
        start()
      if (
        state === 'SMILE' &&
        !wasSmile &&
        mode === 'expression' &&
        !firework?.playing
      ) {
        eventAt = detail.timestamp
        latency = undefined
        hold = 0
        start()
      }
    })
  return {
    setMode(value) {
      mode = value
      if (mode === 'manual') {
        opacity = 1
        transitioning = false
      }
      intensity = 0
      hold = 0
      eventAt = undefined
      latency = undefined
      if (value === 'expression' && state === 'SMILE') start()
    },
    get opacity() {
      return opacity
    },
    consumeResume() {
      const value = resumed
      resumed = false
      return value
    },
    step(dt) {
      const playing = Boolean(firework?.playing)
      if (playing) transitioning = true
      if (
        wasPlaying &&
        !playing &&
        mode === 'expression' &&
        state === 'SMILE'
      ) {
        resumed = true
        start()
      }
      wasPlaying = playing
      if (transitioning && mode === 'expression') {
        const goal = !playing && state === 'SMILE' ? 1 : 0
        opacity +=
          Math.sign(goal - opacity) *
          Math.min(Math.abs(goal - opacity), dt / (goal ? 0.65 : 0.5))
        if (playing || state !== 'SMILE') {
          intensity = 0
          return 0
        }
      }
      if (mode === 'manual') return 1
      hold = Math.max(0, hold - dt)
      const goal = state === 'SMILE' || hold > 0 ? 1 : 0
      const blend = 1 - Math.exp(-dt / (goal ? 0.22 : 0.19))
      intensity += (goal - intensity) * blend
      if (intensity < 0.01 && !goal) intensity = 0
      if (intensity > 0.02 && eventAt !== undefined && latency === undefined)
        latency = Math.max(0, now() - eventAt)
      return intensity
    },
    describe() {
      const transition =
        mode === 'manual'
          ? '手动控制'
          : state === 'SMILE'
            ? intensity < 0.95
              ? '渐入'
              : '持续'
            : intensity > 0
              ? '收束'
              : '等待微笑'
      return `${state} · ${mode === 'manual' ? '手动' : '表情'} · ${transition} · 最近事件 ${eventName} · 生成强度 ${mode === 'manual' ? '100' : Math.round(intensity * 100)}% · 事件至发射器 ${latency === undefined ? '—' : Math.round(latency) + ' ms'}`
    },
  }
}
