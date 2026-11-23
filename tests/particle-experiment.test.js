import {test,expect} from 'vitest'
import {createParticleBrush} from '../src/firework/particle-brush.js'
const withoutTime=p=>{const {birth,life,...rest}=p;return rest}
test('stage isolation, stable streams and explicit linked cluster provenance',()=>{
 for(const seed of [1201,42,917,3061]){
 const [a,b,c]=[1,2,3].map(stage=>createParticleBrush(seed,{stage}))
 expect([a,b,c].map(v=>v.budget)).toEqual([528,528,528])
 expect(a.particles.map(withoutTime)).toEqual(b.particles.map(withoutTime))
 expect(a.particles.map(p=>p.birth)).not.toEqual(b.particles.map(p=>p.birth))
 expect(b.particles.filter(p=>p.type!=='cluster')).toEqual(c.particles.filter(p=>p.type!=='cluster'))
 expect(b.clusters).not.toEqual(c.clusters)
 expect(c.links).toHaveLength(2)
 for(const l of c.links){const stream=c.streams.find(s=>s.id===l.streamId);expect(l.birth).toBeCloseTo(stream.start+l.pathU*stream.span+l.delay)}
 expect(c.streams.filter(s=>s.structure==='complete')).toHaveLength(3)
 expect(c.particles.filter(p=>p.streamId==='stream-2').every(p=>p.pathU>=.3&&p.pathU<=.5||p.pathU>=.72&&p.pathU<=.91)).toBe(true)
 expect(c).toEqual(createParticleBrush(seed,{stage:3}))
 }
})
