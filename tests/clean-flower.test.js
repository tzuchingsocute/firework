import {it,expect} from 'vitest'
import {flowerContour,flowerGeometry,randomFlowers} from '../src/firework/clean-flower.js'
it('one continuous finite five-petal family and deterministic perspective',()=>{expect(flowerContour()).toHaveLength(200);expect(randomFlowers()).toEqual(randomFlowers());for(const v of randomFlowers()){const p=flowerGeometry(v);expect(p.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);for(let i=0;i<p.length;i++)expect(Math.hypot(p[i].x-p[(i+1)%p.length].x,p[i].y-p[(i+1)%p.length].y)).toBeLessThan(10)}})
