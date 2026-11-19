import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { readAlignmentEvidence } from './alignment-evidence.js'
import { checks, coreChecks } from './checks.js'

const readReport = path => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}
const decode = attachment => Buffer.from(attachment.body ?? '', 'base64').toString('utf8')
const format = value => typeof value === 'string' ? value : JSON.stringify(value)
function browserSpecs(suites = []) {
  return suites.flatMap(suite => [...(suite.specs ?? []), ...browserSpecs(suite.suites)])
}

export function report({ environment, fixtures, devices, runnerLogs, repairs, baseline }) {
  const browser = readReport('test-results/browser.json')
  const unit = readReport('test-results/unit.json')
  const specs = browserSpecs(browser?.suites)
  const alignmentEvidence = readAlignmentEvidence(process.env.STAGE1_ALIGNMENT_EVIDENCE || 'reports/face-alignment.json')
  const results = checks.map(([id, dimension, maxScore, name, target, severity, location, suggestion]) => {
    if (baseline && id !== 'D2') {
      const previous = baseline.results.find(item => item.id === id)
      if (!previous) throw new Error(`现有报告缺少 ${id}，请先执行完整评测。`)
      return previous
    }
    const spec = specs.find(s => s.title.startsWith(id + ' '))
    const run = spec?.tests[0]?.results.at(-1)
    const statuses = { passed: 'PASS', failed: 'FAIL', timedOut: 'FAIL', interrupted: 'BLOCKED', skipped: 'BLOCKED' }
    const missingAnnotation = id === 'B7' && !fixtures.enabled
    const missingBehaviorVideo = /^B[2-6]$/.test(id) && !fixtures.behavior.enabled
    const unavailable = missingAnnotation || missingBehaviorVideo
    let status = unavailable ? 'BLOCKED' : statuses[run?.status] ?? (browser ? 'NOT_TESTED' : 'BLOCKED')
    if (id === 'D3' && unit?.numTotalTests === 3) status = unit.numPassedTests === 3 ? 'PASS' : 'FAIL'
    const measurements = run?.attachments?.filter(a => a.name === 'measurements').map(a => JSON.parse(decode(a))) ?? []
    if (id === 'D3' && unit) measurements.push({ total: unit.numTotalTests, passed: unit.numPassedTests })
    const errors = run?.errors?.map(e => e.message ?? e.stack) ?? []
    const logs = run?.attachments?.filter(a => a.name === 'browser-errors').flatMap(a => JSON.parse(decode(a))) ?? []
    const screenshots = run?.attachments?.filter(a => a.contentType === 'image/png' && a.path).map(a => a.path) ?? []
    const outage = status === 'FAIL' && id !== 'D1' && id !== 'D3'
      && logs.some(log => /ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_TIMED_OUT|CERT_AUTHORITY_INVALID)/.test(log))
    if (outage) status = 'BLOCKED'
    const reason = missingAnnotation ? fixtures.reason
      : missingBehaviorVideo ? fixtures.behavior.reason
      : status === 'PASS' ? ''
      : (errors[0] ?? (id === 'D3' ? unit?.testResults?.map(r => r.message).filter(Boolean).join('\n') : ''))
        || '测试未完成，请查看运行日志'
    if (id === 'D2') return { id, name, dimension, status: alignmentEvidence.status, maxScore,
      score: alignmentEvidence.status === 'PASS' ? maxScore : 0,
      measurements: alignmentEvidence.measured ? [alignmentEvidence.measured] : [],
      target, severity, location, reason: alignmentEvidence.reason,
      suggestion: alignmentEvidence.status === 'PASS' ? '' : suggestion, errors: [], logs: [], screenshots: [],
      evidencePath: alignmentEvidence.path }
    return { id, name, dimension, status, maxScore, score: status === 'PASS' ? maxScore : 0,
      measurements, target, severity, location, reason, suggestion: status === 'PASS' ? '' : suggestion, errors, logs, screenshots }
  })

  for (const item of devices) results.push({ id: item.id, name: item.name, dimension: '验收',
    status: item.status, score: 0, maxScore: 0, measurements: item.measurements ?? [],
    target: item.target, reason: item.reason, severity: 'P1', location: '真实设备 / 部署环境',
    suggestion: item.suggestion, errors: [], logs: [], screenshots: [] })
  const totals = group => {
    const maxScore = group.reduce((sum, r) => sum + r.maxScore, 0)
    const verifiedMax = group.filter(r => ['PASS', 'FAIL'].includes(r.status))
      .reduce((sum, r) => sum + r.maxScore, 0)
    return { score: group.reduce((sum, r) => sum + r.score, 0), maxScore, verifiedMax,
      pendingScore: maxScore - verifiedMax }
  }
  const dimensions = Object.fromEntries([...new Set(checks.map(check => check[1]))].map(dimension => {
    const group = results.filter(result => result.dimension === dimension)
    return [dimension, totals(group)]
  }))
  const score = results.reduce((sum, result) => sum + result.score, 0)
  const counts = Object.fromEntries(['PASS', 'FAIL', 'BLOCKED', 'NOT_TESTED'].map(
    status => [status, results.filter(result => result.status === status).length],
  ))
  const unresolved = results.filter(result => result.status !== 'PASS')
    .sort((a, b) => a.severity.localeCompare(b.severity))
  const autoPassed = score >= 90 && coreChecks.every(id => results.find(r => r.id === id).status === 'PASS')
    && !results.some(r => r.dimension !== '验收' && r.status === 'FAIL' && ['P0', 'P1'].includes(r.severity))
  const realPassed = devices.some(d => ['PC', 'MOBILE'].includes(d.id) && d.status === 'PASS')
    && !devices.some(d => ['PC', 'MOBILE'].includes(d.id) && d.status === 'FAIL')
  const verdict = autoPassed ? (realPassed ? 'PASS' : 'AUTO_TEST_PASSED / REAL_DEVICE_PENDING') : 'STAGE_1_NOT_PASSED'
  const browserVersion = specs.flatMap(spec => spec.tests).flatMap(t => t.results)
    .flatMap(r => r.attachments ?? []).find(a => a.name === 'browser-version')
  const data = { timestamp: new Date().toISOString(), verdict, allowStage2: verdict === 'PASS', ...totals(results),
    counts, dimensions, environment: { ...environment, browser: browserVersion ? decode(browserVersion) : (baseline?.environment.browser ?? null) },
    fixtures, devices, metrics: results.find(r => r.id === 'C1').measurements.at(-1) ?? null,
    alignment: results.find(r => r.id === 'D2').measurements.at(-1) ?? null,
    results, unresolved, repairs, runnerLogs, browserRunnerErrors: browser?.errors ?? [] }
  mkdirSync('reports', { recursive: true })
  writeFileSync('reports/test-report.json', JSON.stringify(data, null, 2) + '\n')
  const summary = [
    '# 第一阶段质量评估', '', `**${score} / 100 · ${verdict}**`, '',
    ...Object.entries(dimensions).map(([id, d]) => `- ${id} · 已获得 ${d.score}/${d.maxScore} · 已验证 ${d.score}/${d.verifiedMax} · 待验证 ${d.pendingScore} 分`),
    '', `已验证 ${score}/${data.verifiedMax} · 待验证 ${data.pendingScore} 分`, '', `- 结果数 · ${format(counts)}`, `- 环境 · ${format(data.environment)}`,
    `- 性能 · ${format(data.metrics)}`, `- 真人对齐精度 · ${alignmentEvidence.status} · ${data.alignment ? format(data.alignment) : '未验证'}`,
    `- 测试素材 · ${format(fixtures)}`, `- 修复记录 · ${format(repairs)}`,
    `- 是否进入第二阶段 · ${data.allowStage2 ? '是' : '否'}`, '', '## 未解决事项', '',
    ...unresolved.map(r => `- ${r.id} ${r.name} · ${r.status} · ${r.reason.split('\n')[0]} · ${r.suggestion}`),
    '', '## 各项结果', '',
    ...results.map(r => `- ${r.id} ${r.name} · ${r.status} · ${r.score}/${r.maxScore} · 目标 ${r.target} · 实测 ${r.measurements.length ? format(r.measurements) : '无'}`),
    '', '完整日志与失败截图记录见 test-report.json。', '',
  ].join('\n')
  writeFileSync('reports/test-summary.md', summary)
  console.log(summary)
  return data
}
