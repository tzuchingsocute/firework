import {it,expect} from 'vitest'
import {scaledButterflies,scaleBands} from '../src/firework/butterfly-scale.js'
import {groupedOpenness} from '../src/firework/butterfly-openness-diversity.js'
it('only stable whole-object scale is added to unchanged poses',()=>{const d=scaledButterflies();expect(d).toEqual(scaledButterflies());expect(d.base).toEqual(groupedOpenness().samples);for(let i=0;i<20;i++){const {scale,scaleGroup,...v}=d.samples[i];expect(v).toEqual(d.base[i]);const b=scaleBands.find(b=>b.name===scaleGroup);expect(scale).toBeGreaterThanOrEqual(b.min);expect(scale).toBeLessThanOrEqual(b.max)}expect(Object.values(d.counts).reduce((a,b)=>a+b,0)).toBe(20)})
