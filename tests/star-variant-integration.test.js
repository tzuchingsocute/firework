import {it,expect} from 'vitest'
import {createStarVariantCandidate,starInstance} from '../src/firework/star-variant-integration.js'
import {createIntegratedEndings} from '../src/firework/integrated-endings.js'
for(const seed of [1201,42,917,3061])it(`star-only deterministic integration ${seed}`,()=>{const c=createStarVariantCandidate(seed);expect(c.body).toEqual(createIntegratedEndings(seed));expect(c).toEqual(createStarVariantCandidate(seed));expect(Object.values(c.stars).every(v=>['four','eight'].includes(v.variant))).toBe(true);const count=c.body.events.filter(e=>e.mode==='shaped'&&e.type==='star').length+c.body.particles.filter(p=>p.type==='star').length;expect(Object.keys(c.stars)).toHaveLength(count)} )
