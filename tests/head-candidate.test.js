import {it,expect} from 'vitest'
import {createHeadCandidate,sampleHead} from '../src/firework/head-candidate.js'
it('one deterministic analytic head per unchanged stroke',()=>{
 const c=createHeadCandidate();expect(c).toEqual(createHeadCandidate());expect(c.heads.length).toBe(c.tail.peak.strokes.length)
 for(const h of c.heads){const direct=sampleHead(h,1.2);for(let t=0;t<1.2;t+=1/30)sampleHead(h,t);expect(sampleHead(h,1.2)).toEqual(direct);const a=sampleHead(h,.5),b=sampleHead(h,.50001);expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(.02);expect(sampleHead(h,2).vy).toBeGreaterThan(0)}
 expect(new Set(c.heads.map(h=>h.gravity)).size).toBe(c.heads.length)
})
