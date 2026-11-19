import { expect, it } from 'vitest'
import { projectPoints } from '../src/projection.js'

it('preserves the center and mirrors x without changing y', () => {
  expect(projectPoints([{ x: .5, y: .5 }, { x: .25, y: .25 }], 100, 100, 100, 100))
    .toEqual([{ x: 50, y: 50 }, { x: 75, y: 25 }])
})

it('clips landscape video across the viewport sides', () => {
  expect(projectPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }], 90, 160, 160, 90))
    .toEqual([{ x: 45 + 1280 / 9, y: 0 }, { x: 45 - 1280 / 9, y: 160 }])
})

it('clips portrait video vertically and responds to resize', () => {
  const point = [{ x: .25, y: 0 }]
  expect(projectPoints(point, 100, 100, 100, 200)).toEqual([{ x: 75, y: -50 }])
  expect(projectPoints(point, 50, 100, 100, 200)).toEqual([{ x: 37.5, y: 0 }])
})
