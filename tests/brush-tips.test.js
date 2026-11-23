import {it,expect} from 'vitest'
import {createDensePeak} from '../src/firework/dense-peak.js'
for(const seed of [1201,42,917,3061])it(`stable bounded brush specs and tip spacing ${seed}`,()=>{
 const p=createDensePeak(seed);expect(p).toEqual(createDensePeak(seed));expect(p.particles).toHaveLength(3600)
 expect(new Set(p.strokes.map(s=>s.spec)).size).toBe(3)
 const tips=p.strokes.filter(s=>s.tip!=='natural')
 for(let i=0;i<tips.length;i++)for(let j=i+1;j<tips.length;j++){
  const a=tips[i],b=tips[j],ax=Math.cos(a.angle+a.curvature)*a.length,ay=Math.sin(a.angle+a.curvature)*a.length*p.aspect,bx=Math.cos(b.angle+b.curvature)*b.length,by=Math.sin(b.angle+b.curvature)*b.length*p.aspect
  expect(Math.hypot(ax-bx,ay-by)).toBeGreaterThanOrEqual(a.tipSize+b.tipSize+12)
 }
})
