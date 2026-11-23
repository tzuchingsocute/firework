import { test, expect } from 'vitest'
import { ExpressionManager, names, readScores } from '../src/expression/manager.js'

const scores = (jaw, mouth = .9, eye = .6) => names.map((categoryName, i) => ({
  categoryName, score: [mouth,mouth,jaw,0,0,0,0,eye,eye][i],
}))

test('strong grins keep the fixed score across closed and modestly open mouths', () => {
  for (const jaw of [0,.15,.18,.2,.3]) {
    expect(readScores(scores(jaw)).classification.closedScore).toBe(.8)
  }
  expect(readScores(scores(0,.3,.6)).classification.closedScore).toBe(0)
  expect(readScores(scores(0,.9,.05)).classification.closedScore).toBe(0)
})

test('strong grin confirms after 280 ms with low jaw and valid mouth geometry', () => {
  const manager = new ExpressionManager()
  for (let time = 0; time < 1000; time += 40) {
    manager.update(scores(.02),true,time,{mouthOpenness:.263})
  }
  expect(manager.snapshot.state).toBe('LAUGH')
  expect(manager.changedAt).toBe(280)
  expect(manager.thresholds.laughHoldMs).toBe(280)
  expect(manager.thresholds.laughEnter).toBe(.6)
  expect(manager.thresholds.openLaughEnter).toBe(.65)
})
