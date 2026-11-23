import {it,expect} from 'vitest'
import {createEndingCandidate} from '../src/firework/ending-candidate.js'
import {createDensePeak} from '../src/firework/dense-peak.js'
for(const seed of [1201,42,917,3061])it(`preserves body and bounds ending events ${seed}`,()=>{
 const b=createEndingCandidate(seed);expect(b).toEqual(createEndingCandidate(seed));expect(b.peak).toEqual(createDensePeak(seed))
 for(const mode of ['natural','shaped','secondary'])expect(b.counts[mode]).toBeGreaterThan(0)
 expect(b.events.flatMap(e=>e.shapes).filter(s=>s.size>=12).length).toBeLessThanOrEqual(2)
 for(let t=0;t<b.duration;t+=.01)expect(b.events.filter(e=>e.mode==='secondary'&&t>=e.start&&t<e.start+e.life).length).toBeLessThanOrEqual(3)
 for(const e of b.events.filter(e=>e.mode==='secondary')){expect(e.shapes.length).toBeGreaterThanOrEqual(2);expect(e.particles.length).toBe(22);expect(e.particles.some(p=>Math.hypot(p.vx,p.vy)>20)).toBe(true)}
})
