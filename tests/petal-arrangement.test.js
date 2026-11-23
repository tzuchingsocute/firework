import {it,expect} from 'vitest'
import {arrangementGeometry} from '../src/firework/petal-arrangement.js'
it('five unchanged petals, explicit roots and measured center ratio',()=>{for(const layout of ['A','B','C'])for(const ratio of [.06,.08,.1,.12,.14]){const g=arrangementGeometry(layout,ratio);expect(g.petals).toHaveLength(5);expect(g.centerRadius*2/g.width).toBeCloseTo(ratio);expect(g).toEqual(arrangementGeometry(layout,ratio));for(const p of g.petals)expect(p.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true)}})
