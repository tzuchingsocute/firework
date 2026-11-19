import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createFaceVideo } from './face-fixture.js'

const scratch = mkdtempSync(join(tmpdir(), 'firework-head-space-'))
const env = { ...process.env, STAGE1_FACE_VIDEO: createFaceVideo() }
delete env.STAGE1_VIDEO
const run = (name, args) => spawnSync(process.execPath, [resolve('node_modules/.bin', name), ...args],
  { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const build = run('vite', ['build'])
process.stdout.write(build.stdout ?? '')
const unitPath = join(scratch, 'unit.json')
const unit = run('vitest', ['run', 'tests/head-space.test.js', '--reporter=json', '--outputFile', unitPath])
const browser = build.status === 0 ? run('playwright', ['test', 'tests/face.spec.js', '--grep', 'head space tracks motion',
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
const simulated = browserResult?.stats.expected === 1 ? 'PASS'
  : browserResult?.stats.unexpected ? 'FAIL' : 'BLOCKED'
const browserRun = browserResult?.suites[0]?.specs[0]?.tests[0]?.results.at(-1)
const observation = browserRun?.attachments.find(item => item.name === 'head-space-observation')
const realDevice = [
  '左右平移与碰撞边界同步', '上下平移与碰撞边界同步', '靠近和远离时尺寸变化',
  '左右歪头时旋转一致', '快速晃动推动粒子', '离开画面清空边界和粒子', '重新入画恢复追踪',
].map(name => ({ name, status: 'BLOCKED', reason: '需要真人摄像头操作与实测记录' }))
const geometryStatus = !cases.length ? 'BLOCKED' : unit.status === 0 ? 'PASS' : 'FAIL'
const data = { generatedAt: new Date().toISOString(), build: build.status === 0 ? 'PASS' : 'FAIL',
  geometry: { status: geometryStatus, cases },
  simulatedCamera: { status: simulated, fixture: '公开肖像平移、离开和重新进入；MediaPipe 实际推理',
    observation: observation ? Buffer.from(observation.body, 'base64').toString('utf8') : null,
    errors: browserRun?.errors ?? browserResult?.errors ?? [],
    screenshots: browserRun?.attachments.filter(item => item.contentType === 'image/png').map(item => item.path) ?? [],
    log: browserResult ? undefined : browser?.stdout },
  realDevice, verdict: geometryStatus === 'PASS' && simulated === 'PASS' ? 'AUTO_TEST_PASSED / REAL_DEVICE_PENDING' : 'AUTO_TEST_NOT_PASSED' }
mkdirSync('reports', { recursive: true })
writeFileSync('reports/head-space-report.json', JSON.stringify(data, null, 2) + '\n')
writeFileSync('reports/head-space-summary.md', [
  '# 头部空间追踪评测', '', data.verdict, '',
  `- 构建 · ${data.build}`, `- 模拟摄像头实时推理 · ${simulated}`,
  ...cases.map(test => `- ${test.name} · ${test.status}`),
  '', '## 真人验收', '', ...realDevice.map(test => `- ${test.name} · ${test.status} · ${test.reason}`),
  '', '模拟数据用于验证计算和交互接线。实际发型、仰头与侧脸贴合需要真人复测。', '',
].join('\n'))
console.log(data.verdict)
console.log('reports/head-space-report.json')
process.exitCode = data.verdict.startsWith('AUTO_TEST_PASSED') ? 0 : 1
