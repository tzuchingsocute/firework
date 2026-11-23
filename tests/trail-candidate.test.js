import {it,expect} from 'vitest'
import {createTrailCandidate,trailPosition} from '../src/firework/trail-candidate.js'
import {createHeadCandidate,sampleHead} from '../src/firework/head-candidate.js'
it('unchanged heads, sampled births and independent ageing',()=>{const c=createTrailCandidate();expect(c.head).toEqual(createHeadCandidate());expect(c).toEqual(createTrailCandidate());for(const p of c.particles){const h=c.head.heads[p.headId],q=sampleHead(h,p.birth);expect(Math.hypot(p.x-q.x,p.y-q.y)).toBeLessThan(10);expect(p.life).toBeLessThan(.61);const a=trailPosition(p,p.birth),b=trailPosition(p,p.birth+.1);expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeGreaterThan(0)}expect(c.particles.length).toBeLessThan(10000)})
