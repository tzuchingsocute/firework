import {it,expect} from 'vitest'
import {createBurstCandidate,sampleBurstParticle} from '../src/firework/burst-candidate.js'
import {createSecondaryTrigger} from '../src/firework/secondary-trigger.js'
import {createTrailCandidate} from '../src/firework/trail-candidate.js'
it('preserves triggers and independently moves/fades fixed burst composition',()=>{const c=createBurstCandidate();expect(c.trigger.plans).toEqual(createSecondaryTrigger(createTrailCandidate()).plans);expect(c.particles).toHaveLength(57);expect(c).toEqual(createBurstCandidate());for(const e of c.trigger.plans){const group=c.particles.filter(p=>p.eventId===e.headId);expect(new Set(group.map(p=>p.life)).size).toBe(19);for(const p of group){expect(p.x).toBe(e.position.x);expect(p.y).toBe(e.position.y);expect(sampleBurstParticle(p,p.birth+.1).visible).toBe(true);expect(sampleBurstParticle(p,p.birth+p.life).visible).toBe(false)}}expect(c.particles.every(p=>!sampleBurstParticle(p,c.duration).visible)).toBe(true)})
