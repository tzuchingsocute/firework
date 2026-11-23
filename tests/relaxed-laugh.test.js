import { expect, test } from 'vitest'
import { ExpressionManager, names } from '../src/expression/manager.js'

const scores = (mouth, jaw = 0, eye = .35) => names.map((categoryName, i) => ({
  categoryName, score: [mouth,mouth,jaw,0,0,.3,.3,eye,eye][i],
}))

test('recognizes a strong closed grin with low jaw and mouth-opening evidence', () => {
  const manager = new ExpressionManager()
  const context = { pose:{available:true,valid:true,yaw:0,pitch:0}, mouthOpenness:.02, landmarkGeometryValid:true }
  for(let time=0;time<=1200;time+=40) manager.update(scores(.85),true,time,context)
  expect(manager.snapshot.state).toBe('LAUGH')
})

test('confirms an obvious sustained laugh within 320 ms across normal capture rates', () => {
  for (const interval of [16,40,100]) {
    const manager = new ExpressionManager()
    for(let time=0;time<=320;time+=interval) manager.update(scores(.9,.7,.5),true,time)
    expect(manager.snapshot.state).toBe('LAUGH')
  }
})

test('a short laugh spike remains insufficient and missing faces clear the effect route', () => {
  const manager = new ExpressionManager()
  for(let time=0;time<=200;time+=40) manager.update(scores(.9,.7,.5),true,time)
  expect(manager.snapshot.state).not.toBe('LAUGH')
  manager.update([],false,240)
  expect(manager.snapshot.state).toBe('NO_FACE')
  expect(manager.snapshot.triggerTarget).toBe('None')
})
