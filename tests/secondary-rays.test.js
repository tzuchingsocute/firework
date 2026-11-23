import {it,expect} from 'vitest'
import {secondaryStarGeometry} from '../src/firework/secondary-rays.js'
import {starContour} from '../src/firework/star-perspective.js'
it('zero is identical; variable counts preserve main tips and clearance',()=>{expect(secondaryStarGeometry().points).toEqual(starContour());for(let seed=6019;seed<6040;seed++)for(const count of [2,4,6]){const g=secondaryStarGeometry({secondaryRayCount:count,seed});expect(g.secondaryAngles).toHaveLength(count);expect(g.rays.filter(r=>r.primary)).toHaveLength(4);expect(g.rays.filter(r=>!r.primary).every(r=>r.length<=.45)).toBe(true);expect(g).toEqual(secondaryStarGeometry({secondaryRayCount:count,seed}))}})

it('rejects odd counts and enforces opposite pairs',()=>{for(const count of [1,3,5])expect(()=>secondaryStarGeometry({secondaryRayCount:count})).toThrow();for(let seed=0;seed<50;seed++)for(const count of [2,4,6]){const g=secondaryStarGeometry({secondaryRayCount:count,seed});for(const [a,b]of g.pairs){const d=Math.abs(Math.atan2(Math.sin((a-b)*Math.PI/180),Math.cos((a-b)*Math.PI/180)));expect(Math.abs(d-Math.PI)).toBeLessThanOrEqual(.071)}}})
