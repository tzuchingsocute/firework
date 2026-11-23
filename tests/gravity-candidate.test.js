import {it,expect} from 'vitest'
import {createGravityCandidate,headPosition} from '../src/firework/gravity-candidate.js'
it('reproducible moving triggers and downward gravity',()=>{
 const c=createGravityCandidate();expect(c).toEqual(createGravityCandidate())
 for(const e of c.events.filter(e=>e.mode==='secondary')){const h=headPosition(c.peak.strokes[e.id],e.start,c.peak.aspect);expect(h.vy).toBeGreaterThan(0);expect(e.x).toBe(h.x);expect(e.y).toBe(h.y)}
 for(const s of c.peak.strokes){const a=headPosition(s,0),b=headPosition(s,3);expect(b.y).toBeGreaterThan(a.y)}
})
