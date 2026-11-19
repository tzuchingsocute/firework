import { readFileSync } from 'node:fs'
import { scenes, summarizeSamples } from '../src/alignment-metrics.js'

export function readAlignmentEvidence(path) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    if (data.version !== 1 || data.coordinateSpace !== 'mirrored-stage-css-pixels'
      || !data.samples || typeof data.samples !== 'object') throw new Error('导出格式不符合要求。')
    const captures = new Set()
    for (const [scene, sample] of Object.entries(data.samples)) {
      if (!Object.hasOwn(scenes, scene) || sample.input !== 'real-camera' || sample.annotation !== 'manual'
        || !Number.isFinite(Date.parse(sample.capturedAt)) || captures.has(sample.capturedAt)) {
        throw new Error('场景需要独立的真实摄像头帧和人工标注声明。')
      }
      captures.add(sample.capturedAt)
    }
    const measured = summarizeSamples(data.samples)
    if (!measured?.complete) return { status: 'BLOCKED', path, measured, reason: '需分别采集并标注六个场景。' }
    return { status: measured.pass ? 'PASS' : 'FAIL', path, measured,
      reason: measured.pass ? '' : '平均误差、方向偏差或左右顺序未达到 Demo 验收目标。' }
  } catch (error) {
    return { status: 'BLOCKED', path, reason: error.code === 'ENOENT'
      ? '未找到六场景真人摄像头人工标注 JSON。' : error.message }
  }
}
