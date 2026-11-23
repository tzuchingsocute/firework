import {test,expect} from 'vitest'
import {createBurstScheduler} from '../src/firework/controller.js'
import {createEffectController} from '../src/rain/effect-controller.js'
test('rain waits for completion and checks latest stable expression',()=>{
 const expressions=new EventTarget();expressions.snapshot={state:'SMILE'}
 const firework={playing:false};let starts=0
 const c=createEffectController(expressions,()=>starts++,()=>0,firework);c.setMode('expression')
 const change=state=>expressions.dispatchEvent(new CustomEvent('expression:'+ (state==='LAUGH'?'laugh:start':state==='SMILE'?'smile:start':'smile:end'),{detail:{state,timestamp:0}}))
 change('LAUGH');firework.playing=true;c.step(.5);expect(c.opacity).toBe(0)
 change('SMILE');expect(c.step(.1)).toBe(0)
 change('NEUTRAL');firework.playing=false;expect(c.step(.1)).toBe(0)
 expect(c.consumeResume()).toBe(false)
 firework.playing=true;change('LAUGH');c.step(.1);change('SMILE');c.step(.1)
 firework.playing=false;c.step(.1);expect(c.consumeResume()).toBe(true);expect(c.opacity).toBeGreaterThan(0)
})

test('5 and 15 second laugh repeats at bounded cadence, exit cancels and stalls never catch up',()=>{
 const times=[];let now=0;const scheduler=createBurstScheduler(()=>times.push(now))
 for(now=0;now<=15000;now+=100)scheduler.step({state:'LAUGH',faceDetected:true,timestamp:now},now)
 expect(times.filter(t=>t<=5000)).toHaveLength(4);expect(times).toHaveLength(12)
 now=30000;scheduler.step({state:'LAUGH',faceDetected:true,timestamp:now},now);expect(times).toHaveLength(13)
 scheduler.step({state:'SMILE',faceDetected:true,timestamp:30100},30100)
 scheduler.step({state:'NO_FACE',faceDetected:false,timestamp:35000},35000);expect(times).toHaveLength(13)
 scheduler.step({state:'LAUGH',faceDetected:true,timestamp:36000},36000,false);expect(times).toHaveLength(13)
})
