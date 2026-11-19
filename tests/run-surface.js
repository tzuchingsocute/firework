import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createFaceVideo, crownScenarios } from './face-fixture.js'

const scratch = mkdtempSync(join(tmpdir(), 'firework-surface-'))
const env = { ...process.env, STAGE1_FACE_VIDEO: createFaceVideo({ portraitFraming: true }) }
for (const distance of crownScenarios) {
  env['STAGE1_HEAD_' + distance.toUpperCase()] = createFaceVideo({ portraitFraming: true, headDistance: distance })
}
delete env.STAGE1_VIDEO
const run = (name, args) => spawnSync(process.execPath, [resolve('node_modules/.bin', name), ...args],
  { env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] })
const build = run('vite', ['build'])
process.stdout.write(build.stdout ?? '')
const unitPath = join(scratch, 'unit.json')
const unit = run('vitest', ['run', 'tests/surface.test.js', '--reporter=json', '--outputFile', unitPath])
const browser = build.status === 0 ? run('playwright', ['test', 'tests/surface.spec.js',
  '--reporter=json', '--output', join(scratch, 'browser')]) : undefined
const parse = text => {
  try { return JSON.parse(text) } catch { return null }
}
let unitResult
try { unitResult = parse(readFileSync(unitPath, 'utf8')) } catch { unitResult = null }
const browserResult = parse(browser?.stdout)
const cases = unitResult?.testResults.flatMap(file => file.assertionResults.map(test => ({
  name: test.title, status: test.status === 'passed' ? 'PASS' : 'FAIL', errors: test.failureMessages,
}))) ?? []
const browserRun = browserResult?.suites[0]?.specs[0]?.tests[0]?.results.at(-1)
const simulated = browserRun?.status === 'passed' ? 'PASS'
  : ['failed', 'timedOut'].includes(browserRun?.status) ? 'FAIL' : 'BLOCKED'
const observation = browserRun?.attachments.find(item => item.name === 'surface-measurements')
const qualityRun = browserResult?.suites[0]?.specs[1]?.tests[0]?.results.at(-1)
const attachment = qualityRun?.attachments?.find(item => item.name === 'surface-quality')
const evidence = attachment ? parse(Buffer.from(attachment.body, 'base64').toString('utf8')) : null
const frames = evidence?.frames.filter(frame => frame.coverage && frame.drops) ?? []
const rates = frames.map(frame => frame.coverage.percent).sort((a, b) => a - b)
const mean = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null
const p95 = rates[Math.ceil(rates.length * .95) - 1] ?? null
const contacts = [...new Map((evidence?.contacts ?? []).map(event => [event.id, event])).values()]
const responses = contacts.filter(event => event.responded && !event.penetrating).length
const collisionRate = contacts.length ? responses / contacts.length * 100 : null
const review = qualityRun?.attachments?.find(item => item.name === 'coverage-review')
if (review?.body) {
  mkdirSync('reports', { recursive: true })
  writeFileSync('reports/surface-coverage-review.png', Buffer.from(review.body, 'base64'))
}
const debugScreenshot = qualityRun?.attachments?.find(item => item.name === 'face-mask-debug')
if (debugScreenshot?.body) {
  mkdirSync('reports', { recursive: true })
  writeFileSync('reports/face-mask-debug.png', Buffer.from(debugScreenshot.body, 'base64'))
}
const headDebugRuns = browserResult?.suites[0]?.suites?.flatMap(suite => suite.specs.map(spec => ({
  name: spec.title, ...spec.tests[0]?.results.at(-1),
}))) ?? []
if (browserRun) headDebugRuns.unshift({ name: 'normal', ...browserRun })
const headDebug = headDebugRuns.map(({ name, status, errors, attachments }) => {
  const image = attachments?.find(item => item.name === (name === 'normal' ? 'head-collision-normal' : 'head-collision-debug'))
  const metrics = attachments?.find(item => item.name === 'head-collision-stats')?.body
  const scenario = name === 'normal' ? 'regression' : name.split(' ').at(-1)
  const screenshot = image?.body ? `reports/head-collision-${scenario}.png` : null
  const artifact = attachments?.find(item => item.name === 'crown-specialized')?.body
  const diagnostic = artifact && parse(Buffer.from(artifact, 'base64').toString('utf8'))
  const diagnosticPath = diagnostic ? `reports/crown-${scenario}.json` : null
  if (screenshot) {
    mkdirSync('reports', { recursive: true })
    writeFileSync(screenshot, Buffer.from(image.body, 'base64'))
  }
  if (diagnosticPath) {
    mkdirSync('reports', { recursive: true })
    writeFileSync(diagnosticPath, JSON.stringify(diagnostic, null, 2))
    for (const [index, frame] of diagnostic.anomalyFrames.entries()) {
      writeFileSync(`reports/crown-${scenario}-anomaly-${index + 1}.jpg`, Buffer.from((frame.compositeImage ?? frame.sourceImage).split(',')[1], 'base64'))
    }
  }
  const crownBenchmark = !diagnostic ? undefined : scenario === 'clipped' ? 'UNAVAILABLE'
    : diagnostic.eligible < 50 ? 'INSUFFICIENT_SAMPLE' : diagnostic.rate >= .98 ? 'PASS' : 'FAIL'
  return { name, status, errors, screenshot, metrics: metrics && Buffer.from(metrics, 'base64').toString('utf8'),
    diagnosticPath, crownBenchmark, eligible: diagnostic?.eligible, hits: diagnostic?.hits,
    suspectedPassThrough: diagnostic?.suspectedPassThrough, lateResponses: diagnostic?.lateResponses, prematureRate: diagnostic?.prematureRate, impactError414: diagnostic?.impactError414, rate: diagnostic?.rate }

})
const peakAlpha = frames.length ? Math.max(...frames.map(frame => frame.coverage.maxAlpha)) : null
const quality = {
  collectionStatus: qualityRun?.status ?? 'not_run',
  coverage: { status: !rates.length ? 'BLOCKED' : mean > 1 || p95 > 3 || peakAlpha > 0 ? 'FAIL' : 'PARTIAL',
    mean, p95, peakAlpha, frames: frames.length, invalidFrames: evidence?.frames.filter(frame => !frame.coverage).length ?? 0,
    thresholds: { mean: 1, p95: 3 }, reviewScreenshot: review?.body ? 'reports/surface-coverage-review.png' : null, abnormalTimes: frames.filter(f => f.coverage.percent > 3).map(f => f.videoTime),
    note: '当前素材缺少完整真人场景；五官持续遮挡需复核。' },
  headCollision: { status: !contacts.length ? 'BLOCKED' : collisionRate < 98 || contacts.some(event => !event.splash) ? 'FAIL' : 'PARTIAL',
    expected: contacts.length, responses, rate: collisionRate, events: contacts,
    note: '当前模型共用连续求交；独立轨迹真值仍待验证。' },
  maskStability: { status: frames.length ? 'PARTIAL' : 'BLOCKED', reason: '真人快速移动、转头与恢复仍需视频复核。' },
  scenarios: { tested: ['公开肖像合成素材'], pending: ['真人正面静止10秒', '左右平移', '左右转头', '左右倾斜', '快速晃动', '靠近及远离', '丢失及恢复'] },
}
const realDevice = [
  '真实摄像头头发、头部、双肩和上半身曲面跟随',
  '水珠下落、接触头顶、附着、滑动和脱离',
  '左右肩与躯干表面滑动方向符合姿态',
  '快速晃头引发惯性脱离与飞溅',
  '静止时稳定、离开时清理、重新进入恢复',
].map(name => ({ name, status: 'BLOCKED', reason: '需要真实摄像头操作与验收记录' }))
const geometryStatus = !cases.length ? 'BLOCKED' : unit.status === 0 ? 'PASS' : 'FAIL'
const requiredCrownScenarios = headDebug.filter(result => result.name !== 'normal')
const crownPassed = requiredCrownScenarios.length === crownScenarios.length && requiredCrownScenarios.every(result =>
  result.status === 'passed' && ['PASS', 'UNAVAILABLE'].includes(result.crownBenchmark))
const regressionPassed = geometryStatus === 'PASS' && simulated === 'PASS' && qualityRun?.status === 'passed'
const data = { generatedAt: new Date().toISOString(), build: build.status === 0 ? 'PASS' : 'FAIL',
  geometry: { status: geometryStatus, cases },
  simulatedCamera: { status: simulated, fixture: '公开肖像平移、离开和重新进入；MediaPipe 实际推理',
    observation: observation ? Buffer.from(observation.body, 'base64').toString('utf8') : null,
    errors: browserRun?.errors ?? browserResult?.errors ?? [],
    screenshots: browserRun?.attachments.filter(item => item.contentType === 'image/png').map(item => item.path) ?? [],
    log: browserResult ? undefined : browser?.stdout },
  quality, headDebug, realDevice, regressionPassed,
  crownVerdict: crownPassed ? 'BENCHMARK_PASSED / REAL_DEVICE_PENDING' : 'BENCHMARK_NOT_MET / REAL_DEVICE_PENDING',
  verdict: regressionPassed && crownPassed ? 'AUTO_TEST_PASSED / REAL_DEVICE_PENDING' : 'AUTO_TEST_NOT_PASSED / REAL_DEVICE_PENDING',
}
mkdirSync('reports', { recursive: true })
writeFileSync('reports/surface-report.json', JSON.stringify(data, null, 2) + '\n')
writeFileSync('reports/surface-summary.md', [
  '# 阶段 1.5 人体表面交互评测', '', data.verdict, '',
  `- 构建 · ${data.build}`, `- 模拟摄像头实时推理 · ${simulated}`,
  ...cases.map(test => `- ${test.name} · ${test.status}`),
  '', '## 雨滴质量指标', '',
  `- 面部覆盖率 · ${quality.coverage.status} · 平均 ${mean ?? '—'}% · P95 ${p95 ?? '—'}%`,
  `- 头顶碰撞 · ${quality.headCollision.status} · ${responses}/${contacts.length} · ${collisionRate ?? '—'}%`,
  `- 遮罩稳定性 · ${quality.maskStability.status} · ${quality.maskStability.reason}`,
  '', '## 头顶专项', '', data.crownVerdict,
  ...headDebug.filter(result => result.crownBenchmark).map(result =>
    `- ${result.name} · ${result.crownBenchmark} · ${result.hits}/${result.eligible} · 疑似穿透 ${result.suspectedPassThrough} · ${result.diagnosticPath}`),
  '', '## 真人验收', '', ...realDevice.map(test => `- ${test.name} · ${test.status} · ${test.reason}`),
  '', '模拟数据用于验证计算和交互接线。自动化使用公共领域肖像合成序列，真人肩部动作、表面贴合和飞溅效果仍需实测。', '',
].join('\n'))
console.log(data.verdict)
console.log('Crown:', data.crownVerdict)
console.log('reports/surface-report.json')
process.exitCode = data.verdict.startsWith('AUTO_TEST_PASSED') ? 0 : 1
