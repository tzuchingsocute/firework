import {it,expect} from 'vitest'
import {narrowedPetal} from '../src/firework/flower-negative-space.js'
import {petalSegments} from '../src/firework/petal-geometry.js'
it('only root controls change, outer and tip segments identical',()=>{const old=petalSegments('B');for(const level of ['A','B','C']){const s=narrowedPetal(level);expect(s[1]).toEqual(old[1]);expect(s[2]).toEqual(old[2]);expect(s[0][2]).toEqual(old[0][2]);expect(s[0][3]).toEqual(old[0][3]);expect(s[3][0]).toEqual(old[3][0]);expect(s[3][1]).toEqual(old[3][1]);expect(Math.abs(s[0][0][0])).toBeLessThan(Math.abs(old[0][0][0]))}})
