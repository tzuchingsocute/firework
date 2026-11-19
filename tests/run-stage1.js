import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { arch, platform, release } from 'node:os'
import { report } from './report.js'
import { createFaceVideo, faceFixture } from './face-fixture.js'
import { applyRepair, failingChecks } from './repair.js'

if (process.argv.includes('--alignment-only')) {
  const baseline = JSON.parse(readFileSync('reports/test-report.json', 'utf8'))
  const updated = report({ ...baseline, baseline })
  process.exit(updated.allowStage2 ? 0 : 1)
}

const env = { ...process.env }
const manifest = resolve(env.STAGE1_MANIFEST || 'tests/fixtures/manifest.json')
const fixture = { enabled: false, reason: '未提供合法授权的 Y4M 视频与人工标注；追踪精度未验证。' }
if (existsSync(manifest) || env.STAGE1_MANIFEST || env.STAGE1_VIDEO) {
  try {
    const data = JSON.parse(readFileSync(manifest, 'utf8'))
    const video = env.STAGE1_VIDEO ? resolve(env.STAGE1_VIDEO) : resolve(manifest, '..', data.video)
    if (!video.endsWith('.y4m') || !statSync(video).isFile() || !data.source?.trim() || !data.license?.trim()
      || !data.annotator?.trim()) throw new Error('需要 Y4M 文件、来源、授权和标注者。')
    const normalized = n => Number.isFinite(n) && n >= 0 && n <= 1
    const pointValid = p => Number.isInteger(p.index) && p.index >= 0 && p.index < 478
      && normalized(p.x) && normalized(p.y)
    const scenes = ['front', 'turn', 'move', 'absent', 'return']
    if (data.samples.filter(s => s.scene === 'front').length < 20
      || !scenes.every(scene => data.samples.some(sample => sample.scene === scene))
      || !data.samples.every((s, i) => Number.isFinite(s.time) && s.time > (data.samples[i - 1]?.time ?? 0)
        && scenes.includes(s.scene)
        && (s.scene === 'absent' || (s.points?.length >= 3 && s.points.every(pointValid)
          && new Set(s.points.map(p => p.index)).size === s.points.length
          && normalized(s.box?.width) && s.box.width > 0 && normalized(s.box.height) && s.box.height > 0)))
      || data.samples.find(s => s.scene === 'return').time <= data.samples.find(s => s.scene === 'absent').time
      || data.samples.at(-1).time >= 120) throw new Error('标注样本、场景时间或人脸框不满足素材规范。')
    env.STAGE1_MANIFEST = manifest
    env.STAGE1_VIDEO = video
    Object.assign(fixture, { enabled: true, manifest, video, source: data.source,
      license: data.license, annotator: data.annotator, sampleCount: data.samples.length, reason: '' })
  } catch (error) {
    fixture.reason = `无法使用标注素材 · ${error.message}`
  }
}
if (!fixture.enabled) {
  delete env.STAGE1_MANIFEST
  delete env.STAGE1_VIDEO
}

const devices = [
  { id: 'PC', name: '真实 PC 摄像头', target: '实际授权、关键点贴合、离开与恢复',
    reason: '自动运行器使用模拟摄像头，未收到可核对的 PC 实机记录。' },
  { id: 'MOBILE', name: '真实 iOS / Android 摄像头', target: '前置摄像头和方向变化，移动追踪 ≥ 24 FPS',
    reason: '移动视口使用桌面 Chrome，未收到可核对的 iOS 或 Android 实机记录。' },
  { id: 'HTTPS', name: '公网 HTTPS 访问', target: '公开 HTTPS URL 可访问，摄像头可请求权限',
    reason: '当前项目尚无公网 HTTPS 部署地址。' },
].map(item => ({ ...item, status: 'BLOCKED', suggestion: '提供实际测试环境及实测记录，再进行验收。' }))

if (env.STAGE1_DEVICE_EVIDENCE) {
  try {
    const observed = JSON.parse(readFileSync(env.STAGE1_DEVICE_EVIDENCE, 'utf8'))
    for (const device of devices) {
      const item = observed[device.id]
      if (item?.status === 'FAIL' && item.details && item.date && item.tester) {
        Object.assign(device, { status: 'FAIL', measurements: [item], reason: item.details })
      }
      const validCamera = item?.camera === 'real' && item.permission === true && item.alignment === true
        && item.reacquired === true && Boolean(item.browser) && Boolean(item.device)
      const valid = device.id === 'HTTPS' ? /^https:\/\//.test(item?.url) && item.accessible === true && item.permission === true
        : validCamera && (device.id === 'PC' || (item.fps >= 24 && item.frontCamera === true && item.rotation === true))
      if (item?.status === 'PASS' && item.details && item.date && item.tester && valid) {
        Object.assign(device, { status: 'PASS', measurements: [item], reason: '', suggestion: '' })
      }
    }
  } catch (error) { console.error('无法读取实机记录', error.message) }
}

mkdirSync('test-results', { recursive: true })
delete env.STAGE1_FACE_VIDEO
try {
  env.STAGE1_FACE_VIDEO = createFaceVideo()
  env.STAGE1_SURFACE_VIDEO = createFaceVideo({ portraitFraming: true })
  fixture.behavior = { ...faceFixture, enabled: true, video: env.STAGE1_FACE_VIDEO }
} catch (error) {
  fixture.behavior = { ...faceFixture, enabled: false, reason: error.message }
}
for (const path of ['test-results/unit.json', 'test-results/browser.json']) rmSync(path, { force: true })
function run(name, args) {
  const script = resolve('node_modules', '.bin', name)
  const result = spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message }
}
const testUnit = () => run('vitest', ['run', 'tests/projection.test.js', '--reporter=json', '--outputFile=test-results/unit.json'])
const testBrowser = args => run('playwright', ['test', ...args])
const buildProject = () => run('vite', ['build'])
let unit = testUnit()
let build = buildProject()
let browser = build.exitCode === 0 ? testBrowser([]) : { skipped: '构建失败' }
const history = [{
  test: 'A1', severity: 'P0', finding: '开发期间初跑点击后仍处于待启动。',
  change: '注册监听器后才开放启动按钮，并使用生产构建回归。',
  verification: '见本轮 A1 和完整回归结果。',
}]
const patches = (env.STAGE1_REPAIR_PATCHES ?? '').split(',').filter(Boolean).slice(0, 3)
let rounds = 0
for (const patch of patches) {
  const [failure] = failingChecks()
  if (!failure) break
  const [id, , , name, , severity, location] = failure
  try {
    const files = applyRepair(patch)
    rounds++
    const record = { id, name, severity, location, patch, files }
    history.push(record)
    build = buildProject()
    if (build.exitCode !== 0) {
      record.buildExit = build.exitCode
      browser = { skipped: '修复后构建失败' }
      rmSync('test-results/browser.json', { force: true })
      unit = testUnit()
      break
    }
    const targeted = id === 'D3' ? testUnit() : testBrowser(['--grep', '^' + id + ' '])
    record.targetedExit = targeted.exitCode
    rmSync('test-results/unit.json', { force: true })
    rmSync('test-results/browser.json', { force: true })
    unit = testUnit()
    browser = testBrowser([])
    record.regression = { unit: unit.exitCode, browser: browser.exitCode }
  } catch (error) {
    history.push({ id, patch, error: error.message })
    break
  }
}
const data = report({ environment: { node: process.version, os: platform(), release: release(), arch: arch(),
  camera: fixture.enabled ? 'Chrome fake camera / annotated Y4M' : 'Chrome fake camera / generated pattern',
  channel: env.STAGE1_CHROME_CHANNEL || 'chrome' },
  fixtures: fixture, devices, runnerLogs: { unit, build, browser },
  repairs: { rounds, maxRounds: 3, note: patches.length
    ? '修复仅使用显式提供的补丁。'
    : '没有提供自动应用的源码补丁。', history } })
process.exitCode = data.allowStage2 ? 0 : 1
