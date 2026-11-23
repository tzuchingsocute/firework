import {it,expect} from 'vitest'
import {createParticleBrush} from '../src/firework/composite-brush.js'
import {createParticleBrush as before} from './fixtures/composite-brush-before-groups.js'
for(const seed of [1201,42,917,3061])it(`direction groups preserve optics and outward motion ${seed}`,()=>{
 const b=createParticleBrush(seed),a=before(seed)
 expect(b.particles).toHaveLength(528);expect(b).toEqual(createParticleBrush(seed))
 expect(b.groups).toHaveLength(6);expect(b.groups.reduce((n,g)=>n+g.count,0)).toBe(342)
 expect(b.groups.filter(g=>g.kind==='long')).toHaveLength(2)
 for(let i=0;i<b.particles.length;i++)for(const key of ['size','brightness','shape','stretch','angle'])expect(b.particles[i][key]).toEqual(a.particles[i][key])
 for(const p of b.particles.filter(p=>p.groupId!==undefined)){
  const g=b.groups[p.groupId];expect(p.vx*Math.cos(g.angle)+p.vy*Math.sin(g.angle)).toBeGreaterThan(0)
 }
})
