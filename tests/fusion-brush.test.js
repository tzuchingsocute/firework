import {describe,it,expect} from 'vitest'
import {createParticleBrush} from '../src/firework/composite-brush.js'
import {createParticleBrush as before} from './fixtures/composite-brush-before-fusion.js'
describe('isolated fusion relationships',()=>{
 for(const seed of [1201,42,917,3061])it(`stable budget and causal release ${seed}`,()=>{
  const b=createParticleBrush(seed),old=before(seed)
  expect(b.particles.length).toBe(528)
  expect(b).toEqual(createParticleBrush(seed))
  for(const type of ['stream','cluster','scatter']){
   const a=b.particles.filter(p=>p.type===type),c=old.particles.filter(p=>p.type===type)
   expect(a.length).toBe(c.length)
   for(let i=0;i<a.length;i++)for(const field of ['size','shape','brightness','stretch','angle'])expect(a[i][field]).toEqual(c[i][field])
  }
  for(const s of b.strokes.filter(s=>s.associated)){
   const p=b.primary[s.parentId]
   expect(s.start).toBeCloseTo(p.start+s.pathU*p.span)
   expect(Math.hypot(s.origin.x,s.origin.y)).toBeLessThan(100)
  }
  const c=b.localCenters[0],s=b.strokes[c.strokeId]
  expect(c.start).toBeCloseTo(s.start+c.pathU*s.span)
  for(const role of ['central','primary','associated','local'])expect(b.particles.filter(p=>p.role===role&&p.birth<.48&&p.birth+p.life>.48).length).toBeGreaterThan(10)
  expect(b.particles.every(p=>p.birth+p.life<1.44)).toBe(true)
 })
})
