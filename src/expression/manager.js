import {laughEvidence,classifierPolicy} from './classifier.js'
import {poseCorrection} from './pose.js'
export const defaults = Object.freeze({
  openLaughEnter:.65,openLaughExit:.45,
  smileEnter: .28, smileExit: .21, laughEnter: .60, laughExit: .56,
  smileHoldMs: 300, laughHoldMs: 380, releaseMs: 420, smoothingMs: 100,
  asymmetryPenalty: .2, inhibitionWeight: .55,
  weights: Object.freeze({ mouth: .82, cheek: .1, eye: .05, jaw: .03 }),
  baseline: Object.freeze({ mouth: 0, cheek: 0, eye: 0, jaw: 0 }),
})
export const names = ['mouthSmileLeft', 'mouthSmileRight', 'jawOpen', 'mouthFunnel', 'mouthPucker',
  'cheekSquintLeft', 'cheekSquintRight', 'eyeSquintLeft', 'eyeSquintRight']
const clamp = value => Math.max(0, Math.min(1, value))
const quantile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)]

export function readScores(categories, config = defaults, context = null) {
  const values = Object.fromEntries((categories ?? []).map(c => [c.categoryName, c.score]))
  if (!names.every(name => Number.isFinite(values[name]) && values[name] >= 0 && values[name] <= 1)) return null
  const asymmetry = Math.abs(values.mouthSmileLeft - values.mouthSmileRight)
  const correction=poseCorrection(values,context),w=correction.weight,side=correction.side
  const pair=(name)=>(values[name+'Left']+values[name+'Right'])/2
  const evidence=name=>pair(name)*(1-w)+(side?values[name+side]:pair(name))*w
  const mouth = clamp(evidence('mouthSmile') - config.asymmetryPenalty * asymmetry*(1-w))
  const cheek = evidence('cheekSquint')
  const eye = evidence('eyeSquint')
  const jaw = values.jawOpen
  const features = { mouth, cheek, eye, jaw }
  const adjusted = Object.fromEntries(Object.entries(features).map(([key, value]) =>
    [key, clamp((value - config.baseline[key]) / Math.max(.1, 1 - config.baseline[key]))]))
  const inhibition = 1 - config.inhibitionWeight * Math.max(values.mouthFunnel, values.mouthPucker)
  const total = Object.values(config.weights).reduce((sum, weight) => sum + weight, 0)
  // All supporting terms are gated by mouth evidence. Their combined budget is bounded.
  const contributions = Object.fromEntries(Object.entries(adjusted).map(([key, value]) => [
    key, value * config.weights[key] / total * inhibition * (key === 'mouth' ? 1 : adjusted.mouth),
  ]))
  const absoluteIntensity = mouth * inhibition *
    (config.weights.mouth + cheek * config.weights.cheek + eye * config.weights.eye + jaw * config.weights.jaw) / total
  const smileIntensity = Object.values(contributions).reduce((sum, value) => sum + value, 0)
  const base={smileIntensity,cheekScore:cheek,eyeSquintScore:eye,values};const classification=laughEvidence(base,context,config)
  return { classification,smileIntensity, absoluteIntensity, smileScore: mouth, mouthSmileScore: mouth, cheekScore: cheek, eyeSquintScore: eye,
    jawOpenScore: jaw, laughScore: classification.score, asymmetry, features, contributions, values, correction }
}

export function validateConfig(config) {
  if (!(config.smileExit >= 0 && config.smileExit < config.smileEnter &&
    config.smileEnter < config.laughExit && config.laughExit < config.laughEnter && config.laughEnter <= 1) ||
    !['smileHoldMs', 'laughHoldMs', 'releaseMs', 'smoothingMs'].every(key => Number.isFinite(config[key]) && config[key] > 0) ||
    !['asymmetryPenalty','inhibitionWeight'].every(key => Number.isFinite(config[key]) && config[key] >= 0 && config[key] <= 1) ||
    !['mouth','cheek','eye','jaw'].every(key => Number.isFinite(config.weights[key]) && config.weights[key] >= 0 &&
      Number.isFinite(config.baseline[key]) && config.baseline[key] >= 0 && config.baseline[key] < .9) ||
    !(config.weights.mouth > 0)) throw new Error('表情参数无效，请检查阈值顺序、权重和持续时间')
  if(!((config.openLaughExit??.45)>=0&&(config.openLaughExit??.45)<(config.openLaughEnter??.65)&&(config.openLaughEnter??.65)<=1))throw new Error('张嘴大笑阈值无效')
  return { ...config, weights: { ...config.weights }, baseline: { ...config.baseline } }
}

export class ExpressionManager extends EventTarget {
  constructor() {
    super()
    this.thresholds = defaults
    this.snapshot = { state: 'NO_FACE', smileScore: 0, mouthSmileScore: 0, cheekScore: 0, eyeSquintScore: 0, smileIntensity: 0, absoluteIntensity: 0, jawOpenScore: 0, laughScore: 0, contributions: { mouth: 0, cheek: 0, eye: 0, jaw: 0 }, faceDetected: false, timestamp: 0 }
    this.changedAt = 0
    this.lastValid = undefined
  }
  set thresholds(config) { this.config = validateConfig(config); this.pending = undefined }
  get thresholds() { return this.config }
  emit(name) {
    this.dispatchEvent(new CustomEvent('expression:' + name, { detail: structuredClone(this.snapshot) }))
  }
  transition(state, now, reason = this.decisionReason) {
    const previous = this.snapshot.state
    this.snapshot.state = state
    if (previous === state) return
    this.changedAt = now
    this.transitionReason = `${previous} → ${state}${reason ? " · "+reason : ""}`
    if (previous === 'SMILE' || previous === 'LAUGH') this.emit(previous.toLowerCase() + ':end')
    if (state === 'NO_FACE') this.emit('face:lost')
    if (previous === 'NO_FACE' && state !== 'NO_FACE') this.emit('face:recovered')
    if (state === 'SMILE' || state === 'LAUGH') this.emit(state.toLowerCase() + ':start')
  }
  lose(now, reason = 'face lost or invalid tracking') {
    this.decisionReason=reason
    this.snapshot.requestedState='NO_FACE'
    this.snapshot.decisionReason=reason
    this.snapshot = { ...this.snapshot, smileScore: 0, mouthSmileScore: 0, cheekScore: 0, eyeSquintScore: 0, smileIntensity: 0, absoluteIntensity: 0, jawOpenScore: 0, laughScore: 0, contributions: { mouth: 0, cheek: 0, eye: 0, jaw: 0 }, faceDetected: false, timestamp: now }
    this.transition('NO_FACE', now)
    this.pending = undefined
    this.lastValid = undefined
    this.rawSmile = this.holdProgress = 0
    this.snapshot.diagnostics={pose:{available:false,valid:false},landmarkTrackingConfidence:null,mouthOpenness:null}
    this.snapshot.triggerTarget='None'
  }
  expire(now) {
    if (this.lastValid !== undefined && now - this.lastValid > 350) this.lose(now,'tracking stale >350ms')
  }
  update(categories, faceDetected, now, context = null) {
    if (!Number.isFinite(now) || now < this.snapshot.timestamp) return this.snapshot
    const raw = faceDetected && readScores(categories, this.thresholds, context)
    if (!raw) { this.decisionReason='face missing or invalid blendshapes';this.lose(now);this.snapshot.diagnostics={...this.snapshot.diagnostics,...context}; return this.snapshot }
    const elapsed = this.lastValid === undefined ? Infinity : now - this.lastValid
    if (elapsed > 350 && this.lastValid !== undefined) this.lose(now)
    const blend = 1 - Math.exp(-elapsed / this.thresholds.smoothingMs)
    for (const key of ['smileScore', 'mouthSmileScore', 'cheekScore', 'eyeSquintScore', 'jawOpenScore', 'laughScore', 'smileIntensity', 'absoluteIntensity']) {
      this.snapshot[key] += (raw[key] - this.snapshot[key]) * blend
    }
    for (const key of Object.keys(raw.contributions)) {
      this.snapshot.contributions[key] += (raw.contributions[key] - this.snapshot.contributions[key]) * blend
    }
    this.snapshot.diagnostics={...context,classification:raw.classification,rawValues:raw.values,correctedRawIntensity:raw.smileIntensity,uncorrectedIntensity:readScores(categories,this.thresholds).smileIntensity,correction:raw.correction}
    this.lastValid = now
    this.snapshot.faceDetected = true
    this.snapshot.timestamp = now
    if (this.snapshot.state === 'NO_FACE') this.transition('NEUTRAL', now)
    this.rawSmile = raw.smileScore
    const intensity = this.snapshot.smileIntensity
    const t = this.thresholds
    const laughing = this.snapshot.state === 'LAUGH'
    const smiling = this.snapshot.state === 'SMILE' || laughing
    const strong = this.snapshot.laughScore >= (laughing ? (t.openLaughExit??classifierPolicy.laughExit) : (t.openLaughEnter??classifierPolicy.laughEnter))
    const candidate = raw.correction.quality==='unsupported' ? 'NEUTRAL' : strong ? 'LAUGH' : intensity >= (smiling ? t.smileExit : t.smileEnter) ? 'SMILE' : 'NEUTRAL'
    this.decisionReason=raw.correction.quality==='unsupported'?raw.correction.reason:`${candidate} priority; smile intensity ${intensity.toFixed(3)} / independent laugh ${this.snapshot.laughScore.toFixed(3)} threshold ${(laughing?(t.openLaughExit??classifierPolicy.laughExit):(t.openLaughEnter??classifierPolicy.laughEnter)).toFixed(3)}; ${raw.correction.reason}`
    this.snapshot.decisionReason=this.decisionReason
    this.snapshot.requestedState=candidate
    const rank = { NEUTRAL: 0, SMILE: 1, LAUGH: 2 }
    const holdMs = rank[candidate] < rank[this.snapshot.state] ? t.releaseMs
      : candidate === 'LAUGH' ? t.laughHoldMs : t.smileHoldMs
    this.holdProgress = this.pending?.state === candidate ? Math.min(1, (now - this.pending.since) / holdMs) : 0
    if (candidate === this.snapshot.state) this.pending = undefined
    else if (this.pending?.state !== candidate) this.pending = { state: candidate, since: now }
    else if (now - this.pending.since >= holdMs) { this.transition(candidate, now); this.pending = undefined }
    this.snapshot.triggerTarget=this.snapshot.state==='LAUGH'?'Fireworks':this.snapshot.state==='SMILE'?'Rain':'None'
    if (this.snapshot.state === 'SMILE') this.emit('smile:update')
    return structuredClone(this.snapshot)
  }
}

function calibrationError(stage, message) {
  return Object.assign(new Error(message), { stage })
}

export function calibrationScores(rows, config = defaults) {
  return rows.map(row => readScores(names.map(categoryName =>
    ({ categoryName, score: row.values?.[categoryName] })), config, row.geometry))
}

export function calibrate(samples, config = defaults) {
  const parsed = {}
  for (const stage of ['NEUTRAL', 'SMILE', 'LAUGH']) {
    const rows = samples[stage]
    if (!rows || rows.length < 20 || rows.at(-1).time - rows[0].time < 1900 ||
      rows.some((row, index) => !Number.isFinite(row.time) ||
        index > 0 && (row.time <= rows[index - 1].time || row.time - rows[index - 1].time > 350))) {
      throw calibrationError(stage, '采样不足或追踪中断，请保持表情约 2 秒后重试当前步骤')
    }
    parsed[stage] = calibrationScores(rows, config)
    if (parsed[stage].some(row => !row)) throw calibrationError(stage, '关键点样本无效，请重采当前步骤')
  }
  const baseline = Object.fromEntries(['mouth','cheek','eye','jaw'].map(key =>
    [key, Math.min(.89, quantile(parsed.NEUTRAL.map(row => row.features[key]), .5))]))
  const personalized = { ...config, baseline }
  const stats = stage => {
    const scores = calibrationScores(samples[stage], personalized).map(row => row.smileIntensity)
    return { low: quantile(scores, .2), median: quantile(scores, .5), high: quantile(scores, .8) }
  }
  const neutral = stats('NEUTRAL')
  const smile = stats('SMILE')
  const strong = stats('LAUGH')
  const startGap = smile.median - neutral.median
  if (startGap < .075) throw calibrationError('SMILE', '自然表情和微笑的强度过于接近，请只重采微笑')
  const smileEnter = neutral.median + startGap * .6
  const smileExit = neutral.median + startGap * .34
  const gap = strong.median - smile.median
  const reliable = gap >= .075 && strong.low > smile.median
  const overlapping = smile.high >= strong.low
  const conservative = Math.min(.98, Math.max(config.laughEnter, smile.high + .075, smileEnter + .1))
  const laughEnter = reliable ? smile.median + gap * (overlapping ? .76 : .63) : conservative
  const laughExit = Math.max(smileEnter + .015, laughEnter - Math.min(.065, Math.max(.025, gap * .28)))
  return validateConfig({ ...personalized, smileEnter, smileExit, laughEnter, laughExit,
    calibration: { reliable, overlapping, neutral, smile, strong, gap } })
}

export function withSensitivity(config, level) {
  const factor = { sensitive: .8, balanced: 1, strict: 1.2 }[level] ?? 1
  const floor = config.calibration?.smile.median ?? config.smileEnter
  const separation = config.laughEnter - floor
  const laughEnter = Math.min(1, Math.max(config.smileEnter + .045, floor + separation * factor))
  const laughExit = Math.max(config.smileEnter + .01, laughEnter - (config.laughEnter - config.laughExit))
  return validateConfig({ ...config, laughEnter, laughExit })
}

export function tuneSmile(config, level) {
  const scale = { sensitive: .85, balanced: 1, strict: 1.15 }[level] ?? 1
  const floor = Math.min(config.smileExit, config.calibration?.neutral.high ?? 0)
  const smileEnter = Math.min(config.laughExit - .005, floor + (config.smileEnter - floor) * scale)
  const smileExit = Math.min(smileEnter - .001, floor + (config.smileExit - floor) * scale)
  return validateConfig({ ...config, smileEnter, smileExit })
}

export function recalibrateSmile(rows, config) {
  const scores = calibrationScores(rows, config)
  if (!config.calibration || scores.some(row => !row) || rows.length < 20 ||
    rows.at(-1).time - rows[0].time < 1900 ||
    rows.some((row, i) => !Number.isFinite(row.time) || i > 0 &&
      (row.time <= rows[i - 1].time || row.time - rows[i - 1].time > 350))) {
    throw new Error('微笑采样不足或追踪中断，请重试')
  }
  const values = scores.map(row => row.smileIntensity)
  const smile = { low: quantile(values, .2), median: quantile(values, .5), high: quantile(values, .8) }
  const neutral = config.calibration.neutral
  const gap = smile.low - neutral.high
  if (gap < .025) throw new Error('轻微微笑与自然表情样本重叠，请重采微笑')
  const smileEnter = Math.min(config.laughExit - .015, neutral.high + gap * .55)
  const smileExit = Math.min(smileEnter - .005, neutral.high + gap * .22)
  return validateConfig({ ...config, smileEnter, smileExit, smileSample: smile })
}
