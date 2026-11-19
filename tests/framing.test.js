import { expect, it } from 'vitest'
import { createFramingState, judgeFraming } from '../src/framing.js'
import { projectPoints, videoGeometry } from '../src/projection.js'

const ideal = { top: .15, bottom: .57, left: .3, right: .7, shoulders: true, torso: true, confidence: 'high' }

it('contains all source pixels for wide and narrow aspect ratios', () => {
  for (const [w, h] of [[1280, 720], [720, 1280], [1080, 1920], [640, 480]]) {
    const fit = videoGeometry(414, 896, w, h, 'contain')
    expect(fit.cropX).toBeCloseTo(0)
    expect(fit.cropY).toBeCloseTo(0)
  }
  expect(videoGeometry(414, 896, 1280, 720).cropX).toBeCloseTo(.740)
})

it('projects mirrored landmarks through contain and cover offsets', () => {
  const p = [{ x: .25, y: 0 }]
  expect(projectPoints(p, 414, 896, 640, 360, 'contain')).toEqual([{ x: 310.5, y: 331.5625 }])
  expect(projectPoints(p, 414, 896, 640, 360, 'cover')[0].x).toBeCloseTo(605.222)
})

it.each([
  [{}, 'Ideal', /已就绪/],
  [{ bottom: .9 }, 'Invalid', /远离/],
  [{ sourceClipped: 'top' }, 'Invalid', /头顶完整/],
  [{ shoulders: false }, 'Invalid', /双肩/],
  [{ left: .06, right: .32 }, 'Invalid', /向右/],
  [{ left: .68, right: .94 }, 'Invalid', /向左/],
  [{ bottom: .38 }, 'Acceptable', /靠近/],
  [{ confidence: 'low' }, 'Acceptable', /互动/],
])('classifies framing and directs the next adjustment for %j', (change, state, message) => {
  expect(judgeFraming({ ...ideal, ...change }, 'Invalid')).toEqual([state, expect.stringMatching(message)])
})

it('requires sustained transitions, keeps moving subjects stable, and clears ready guidance', () => {
  const update = createFramingState()
  const good = judgeFraming(ideal)
  const bad = judgeFraming({ ...ideal, top: 0 })
  expect(update(good, 0).state).toBe('Invalid')
  expect(update(good, 500).state).toBe('Ideal')
  expect(update(bad, 600).state).toBe('Ideal')
  expect(update(good, 900).state).toBe('Ideal')
  expect(update(good, 2200).message).toBe('')
  update(bad, 2300)
  expect(update(bad, 3900).state).toBe('Invalid')
})

it('detects a source-clipped crown even when contain puts space above the video', async () => {
  const { framingSample } = await import('../src/framing.js')
  const pose = Array.from({ length: 33 }, () => ({ x: .5, y: .35, visibility: 1 }))
  pose[11] = { x: .25, y: .65, visibility: 1 }
  pose[12] = { x: .75, y: .65, visibility: 1 }
  const mask = new Uint8Array(20 * 20)
  for (let y = 0; y < 8; y++) for (let x = 7; x <= 12; x++) mask[y * 20 + x] = y < 3 ? 1 : 3
  for (let y = 14; y < 19; y++) for (let x = 5; x < 15; x++) mask[y * 20 + x] = 4
  const sample = framingSample({ pose, mask, maskWidth: 20, maskHeight: 20,
    videoWidth: 640, videoHeight: 360, mode: 'contain', chin: { x: .5, y: .45 } }, 414, 896)
  expect(sample.top).toBeCloseTo(.025)
  expect(sample.sourceClipped).toBe('top')
  expect(judgeFraming(sample)[1]).toContain('头顶完整')
})

it('projects an off-center portrait crop with the mirrored video offset', () => {
  const geometry = videoGeometry(414, 896, 640, 360, 'cover:0.65')
  const [center] = projectPoints([{ x: .65, y: .5 }], 414, 896, 640, 360, 'cover:0.65')
  expect(center.x).toBeCloseTo(207)
  expect(center.y).toBeCloseTo(448)
  expect(geometry.cropX).toBeCloseTo(.740, 2)
})

it('uses a subject-centered crop only when the tracked head and shoulders fit', async () => {
  const { safePortraitCrop } = await import('../src/framing.js')
  const pose = Array.from({ length: 33 }, () => ({ x: .65, y: .36, visibility: 1 }))
  pose[11] = { x: .55, y: .60, visibility: 1 }
  pose[12] = { x: .75, y: .60, visibility: 1 }
  const mask = new Uint8Array(40 * 30)
  for (let y = 6; y < 15; y++) for (let x = 23; x < 29; x++) mask[y * 40 + x] = y < 9 ? 1 : 3
  for (let y = 20; y < 27; y++) for (let x = 22; x < 30; x++) mask[y * 40 + x] = 4
  const frame = { pose, mask, maskWidth: 40, maskHeight: 30,
    videoWidth: 640, videoHeight: 480, chin: { x: .65, y: .49 } }
  const mode = safePortraitCrop(frame)
  expect(mode).toMatch(/^cover:/)
  expect(Number(mode.split(':')[1])).toBeCloseTo(.65)
  pose[11].x = .36
  expect(safePortraitCrop(frame, mode)).toBe('contain')
})
