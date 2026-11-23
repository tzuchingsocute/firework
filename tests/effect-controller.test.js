import { expect, it, vi } from 'vitest'
import { createEffectController } from '../src/rain/effect-controller.js'
import { createRain, defaults } from '../src/rain/rain.js'

it('starts on smile, settles through laugh and neutral, and immediately stops emission on tracking loss', () => {
  const source = new EventTarget()
  source.snapshot = { state:'NEUTRAL' }
  const emit = (event,state) => source.dispatchEvent(new CustomEvent('expression:'+event,{detail:{state,timestamp:100}}))
  const start = vi.fn()
  const effect = createEffectController(source,start,()=>130)
  emit('smile:start','SMILE')
  expect(start).not.toHaveBeenCalled()
  expect(effect.step(.02)).toBe(1)
  effect.setMode('expression')
  expect(start).toHaveBeenCalledTimes(1)
  expect(effect.step(.02)).toBeGreaterThan(0)
  emit('smile:end','LAUGH')
  emit('laugh:start','LAUGH')
  expect(effect.step(.02)).toBeGreaterThan(0)
  for(let i=0;i<80;i++) effect.step(.02)
  expect(effect.step(.02)).toBe(0)
  emit('laugh:end','SMILE')
  emit('smile:start','SMILE')
  expect(start).toHaveBeenCalledTimes(2)
  effect.step(.02)
  expect(effect.describe()).toContain('30 ms')
  emit('smile:end','NO_FACE')
  emit('face:lost','NO_FACE')
  expect(effect.step(.02)).toBe(0)
  emit('face:recovered','NEUTRAL')
  expect(effect.step(.02)).toBe(0)
})
it('zero emission preserves existing rain identity and advances it to natural expiry', ()=>{
  const rain=createRain(()=>.5)
  for(let i=0;i<100;i++) rain.advance(.05,defaults)
  const drop=rain.drops[0]
  const id=drop.id
  const y=drop.y
  rain.advance(.01,defaults,undefined,undefined,0)
  expect(rain.drops.some(p=>p.id===id && p.y>y)).toBe(true)
  const ids=new Set(rain.drops.map(p=>p.id))
  for(let i=0;i<200;i++){
    rain.advance(.05,defaults,undefined,undefined,0)
    expect(rain.drops.every(p=>ids.has(p.id))).toBe(true)
  }
  expect(rain.drops).toHaveLength(0)
})

it('wakes the firework handoff once when smile-end and laugh-start share a transition', () => {
  const source = new EventTarget()
  source.snapshot = { state: 'SMILE' }
  const start = vi.fn()
  const firework = { playing: false }
  const effect = createEffectController(source, start, () => 100, firework)
  effect.setMode('expression')
  start.mockClear()
  for (const name of ['smile:end', 'laugh:start']) {
    source.dispatchEvent(new CustomEvent('expression:' + name, {
      detail: { state: 'LAUGH', timestamp: 100 },
    }))
  }
  expect(start).toHaveBeenCalledTimes(1)
  firework.playing = true
  expect(effect.step(.5)).toBe(0)
  expect(effect.opacity).toBe(0)
})
