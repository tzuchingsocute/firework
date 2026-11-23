import {it,expect} from 'vitest'
import {flowerPerspectiveGeometry,randomFlowerPerspectives} from '../src/firework/flower-perspective.js'
it('fixed five surfaces, stable center and continuous projection',()=>{expect(randomFlowerPerspectives()).toEqual(randomFlowerPerspectives());for(let a=-45;a<45;a+=3){const g=flowerPerspectiveGeometry({yaw:a,pitch:a*.5,roll:0});expect(g.petals).toHaveLength(5);expect(g.center.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);expect(g.petals.every(s=>s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))).toBe(true)}})
