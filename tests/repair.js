import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { checks } from './checks.js'

const allowed = /^(?:index\.html|style\.css|src\/[\w/-]+\.js)$/

function suites(entries = []) {
  return entries.flatMap(entry => [...(entry.specs ?? []), ...suites(entry.suites)])
}

export function failingChecks() {
  const read = path => {
    try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
  }
  const browser = read('test-results/browser.json')
  const unit = read('test-results/unit.json')
  const failed = suites(browser?.suites).filter(spec =>
    spec.tests.some(test => ['failed', 'timedOut'].includes(test.results.at(-1)?.status)))
    .map(spec => spec.title.split(' ')[0])
  if (unit?.numFailedTests) failed.push('D3')
  return checks.filter(([id]) => failed.includes(id)).sort((a, b) => a[5].localeCompare(b[5]))
}

export function applyRepair(path) {
  const input = readFileSync(path, 'utf8')
  const invoke = (...args) => spawnSync('git', ['apply', ...args], { input, encoding: 'utf8' })
  const stat = invoke('--numstat')
  const files = stat.stdout?.trim().split('\n').map(line => line.split('\t').at(-1)) ?? []
  if (stat.status || !files.length || files.some(file => !allowed.test(file) || file === 'src/diagnostics.js')) {
    throw new Error('修复补丁必须只改动允许的业务文件。')
  }
  const check = invoke('--check')
  if (check.status) throw new Error(check.stderr.trim())
  const applied = invoke()
  if (applied.status) throw new Error(applied.stderr.trim())
  return files
}
