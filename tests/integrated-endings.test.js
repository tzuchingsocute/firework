import {it,expect} from 'vitest'
import {createIntegratedEndings} from '../src/firework/integrated-endings.js'
import {createTrailCandidate} from '../src/firework/trail-candidate.js'
for(const seed of [1201,42,917,3061])it(`three stable ending modes ${seed}`,()=>{const c=createIntegratedEndings(seed);expect(c).toEqual(createIntegratedEndings(seed));expect(c.base.trail.head).toEqual(createTrailCandidate(seed).head);for(const mode of ['natural','shaped','secondary'])expect(c.events.filter(e=>e.mode===mode).length).toBeGreaterThan(0);for(let t=0;t<c.duration;t+=.01)expect(c.events.filter(e=>e.mode==='secondary'&&t>=e.time&&t<e.time+.85).length).toBeLessThanOrEqual(3);expect(c.particles.every(p=>p.birth+p.life<c.duration)).toBe(true)})
