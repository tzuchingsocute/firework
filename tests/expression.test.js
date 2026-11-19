import { it, expect } from 'vitest'
import { ExpressionManager, names, readScores, calibrate, defaults, withSensitivity } from '../src/expression/manager.js'
const values = (mouth = 0, jaw = 0, cheek = 0, eye = 0, pucker = 0, right = mouth) =>
  names.map((categoryName, i) => ({ categoryName, score: [mouth,right,jaw,pucker,0,cheek,cheek,eye,eye][i] }))
function hold(m, input, start, duration = 1200, interval = 40) {
  for(let time=start;time<=start+duration;time+=interval) m.update(input,true,time)
}
it('normalizes contributions and accepts natural asymmetry while rejecting invalid input',()=>{
  const v=readScores(values(.9,0,.6,.5,0,.7))
  expect(v.mouthSmileScore).toBeCloseTo(.76)
  expect(v.smileIntensity).toBeCloseTo(Object.values(v.contributions).reduce((a,b)=>a+b,0))
  expect(readScores([])).toBeNull()
  expect(readScores(values(NaN))).toBeNull()
})
for(const [name,input,state] of [
  ['neutral',values(),'NEUTRAL'],
  ['mild closed smile',values(.48,0,.15,.1),'SMILE'],
  ['strong closed smile',values(.92,0,.7,.6),'LAUGH'],
  ['toothy smile',values(.9,.12,.7,.5),'LAUGH'],
  ['open laugh',values(.9,.7,.7,.5),'LAUGH'],
  ['mouth only',values(.04,.9),'NEUTRAL'],
  ['eyes only',values(0,0,0,1),'NEUTRAL'],
  ['smiling speech',values(.5,.8,.2,.2),'SMILE'],
]) it(name,()=>{ const m=new ExpressionManager();hold(m,input,0);expect(m.snapshot.state).toBe(state) })
it('gradual increase and decrease emits one-shot events in order',()=>{
  const m=new ExpressionManager(), events=[]
  for(const name of ['smile:start','smile:end','laugh:start','laugh:end']) m.addEventListener('expression:'+name,()=>events.push(name))
  hold(m,values(),0)
  hold(m,values(.5),1240);expect(m.snapshot.state).toBe('SMILE')
  hold(m,values(.94,0,.8,.6),2480);expect(m.snapshot.state).toBe('LAUGH')
  hold(m,values(.5),3720);expect(m.snapshot.state).toBe('SMILE')
  hold(m,values(),4960);expect(m.snapshot.state).toBe('NEUTRAL')
  expect(events).toEqual(['smile:start','smile:end','laugh:start','laugh:end','smile:start','smile:end'])
})
it('holds at hysteresis boundary, rejects spikes and clears face loss and gaps',()=>{
  const m=new ExpressionManager();let lost=0
  m.addEventListener('expression:face:lost',()=>lost++)
  hold(m,values(.5),0);hold(m,values(.33),1240)
  expect(m.snapshot.state).toBe('SMILE')
  m.update(values(1,1,1,1),true,2480);expect(m.snapshot.state).toBe('SMILE')
  m.update([],false,2520);m.update([],false,2560)
  expect(lost).toBe(1);expect(m.snapshot.smileIntensity).toBe(0)
  hold(m,values(),2600);m.expire(4300);expect(m.snapshot.state).toBe('NO_FACE')
})
it('talking oscillations and single sided smile do not trigger laugh',()=>{
  const m=new ExpressionManager()
  for(let time=0;time<60000;time+=40) {
    m.update(values(.5,time%400<160?.8:.05,.1,.2,0,time<20000?.1:.5),true,time)
    expect(m.snapshot.state).not.toBe('LAUGH')
  }
})
it('independent state timing works across frame rates',()=>{
  for(const interval of [16,40,100]) {
    const m=new ExpressionManager();let starts=0
    m.addEventListener('expression:laugh:start',()=>starts++)
    hold(m,values(.95,0,.8,.6),0,2000,interval)
    expect(starts).toBe(1)
    expect(m.changedAt).toBeGreaterThanOrEqual(380)
    expect(m.changedAt).toBeLessThanOrEqual(500)
  }
})
it('calibrates closed smiles and uses conservative fallback for low separation',()=>{
  const sample=(v)=>Array.from({length:51},(_,i)=>({...readScores(v),time:i*40}))
  const data={NEUTRAL:sample(values(.05)),SMILE:sample(values(.4,0,.1)),LAUGH:sample(values(.9,0,.8,.6))}
  const config=calibrate(data)
  expect(config.laughEnter).toBeGreaterThan(config.laughExit)
  const m=new ExpressionManager();m.thresholds=config
  hold(m,values(.85,.01,.75,.5),0)
  expect(m.snapshot.state).toBe('LAUGH')
  expect(calibrate({...data,LAUGH:data.SMILE}).calibration.reliable).toBe(false)
  expect(()=>calibrate({...data,SMILE:[]})).toThrow()
  expect(()=>{m.thresholds={...defaults,laughEnter:.1}}).toThrow()
})
it('keeps computation bounded and timestamps monotonic',()=>{
  const m=new ExpressionManager(), start=performance.now()
  for(let i=0;i<10000;i++) m.update(values(.9,.6,.7,.5),true,i*16)
  expect(performance.now()-start).toBeLessThan(2000)
  m.update(values(),true,0);expect(m.snapshot.timestamp).toBe(9999*16)
})

it('accepts overlapping tails and recognizes an independent weaker closed grin after calibration',()=>{
  const sample = fn => Array.from({length:51},(_,i)=>({...readScores(fn(i)),time:i*40}))
  const data = {
    NEUTRAL:sample(()=>values(.04)),
    SMILE:sample(i=>values(i%4===0?.53:.37,0,.1)),
    LAUGH:sample(i=>values(i%5===0?.48:.65,0,.35,.2)),
  }
  const config=calibrate(data)
  expect(config.calibration.reliable).toBe(true)
  expect(config.calibration.overlapping).toBe(true)
  const old=new ExpressionManager(), personalized=new ExpressionManager()
  personalized.thresholds=config
  const closed=values(.62,0,.32,.18)
  hold(old,closed,0); hold(personalized,closed,0)
  expect(old.snapshot.state).toBe('SMILE')
  expect(personalized.snapshot.state).toBe('LAUGH')
  expect(old.snapshot.absoluteIntensity).toBeCloseTo(personalized.snapshot.absoluteIntensity)
  expect(withSensitivity(config,'sensitive').laughEnter).toBeLessThan(config.laughEnter)
  expect(withSensitivity(config,'strict').laughEnter).toBeGreaterThan(config.laughEnter)
  expect(withSensitivity(config,'strict').smileEnter).toBe(config.smileEnter)
})

it('recognizes a sustained mild closed smile with the new defaults', () => {
  const legacy = new ExpressionManager()
  legacy.thresholds = { ...defaults, smileEnter: .32, smileExit: .24 }
  const current = new ExpressionManager()
  for (const manager of [legacy, current]) {
    hold(manager, values(.05), 0)
    hold(manager, values(.36), 1240)
  }
  expect(legacy.snapshot.state).toBe('NEUTRAL')
  expect(current.snapshot.state).toBe('SMILE')
})
