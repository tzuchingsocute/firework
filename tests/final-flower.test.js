import {it,expect} from 'vitest'
import {createBlossomPetal,createBlossomGeometry} from '../src/firework/final-flower.js'
it('closed short-root oval curves, five bounded petals and small center',()=>{const s=createBlossomPetal();for(let i=0;i<s.length;i++){expect(s[i][3]).toEqual(s[(i+1)%s.length][0])}for(const v of ['A','B','C']){const g=createBlossomGeometry(v);expect(g.petals).toHaveLength(5);expect(g.centerRadius*2/g.width).toBeCloseTo(.06);expect(g).toEqual(createBlossomGeometry(v))}})
