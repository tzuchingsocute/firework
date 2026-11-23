import {it,expect} from 'vitest'
import {createTrailCandidate} from '../src/firework/trail-candidate.js'
import {sampleHead} from '../src/firework/head-candidate.js'
import {createSecondaryTrigger,updateSecondaryTrigger} from '../src/firework/secondary-trigger.js'
import {lifecycleSnapshot} from '../src/firework/candidate-lifecycle.js'
it('one real descending trigger per selected head, old trail survives',()=>{const c=createTrailCandidate(),s=createSecondaryTrigger(c);expect(s.plans).toHaveLength(3);updateSecondaryTrigger(s,3);updateSecondaryTrigger(s,3);expect(s.events).toHaveLength(3);for(const e of s.events){const h=c.head.heads[e.headId],p=sampleHead(h,e.time);expect(e.position).toEqual({x:p.x,y:p.y});expect(p.vy).toBeGreaterThan(8);expect(e.time-h.birth).toBeGreaterThanOrEqual(.7);const snap=lifecycleSnapshot(s.lifecycle,e.time+.01);expect(snap.heads.some(h=>h.id===e.headId)).toBe(false);expect(snap.trails.some(p=>p.headId===e.headId)).toBe(true);expect(snap.trails.filter(p=>p.headId===e.headId).every(p=>p.birth<e.time)).toBe(true)}})
it('frame stepping and direct time sampling produce identical events',()=>{const a=createSecondaryTrigger(createTrailCandidate()),b=createSecondaryTrigger(createTrailCandidate());for(let t=0;t<3;t+=1/30)updateSecondaryTrigger(a,t);updateSecondaryTrigger(b,3);expect(a.events).toEqual(b.events)})
