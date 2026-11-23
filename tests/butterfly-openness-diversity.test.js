import {it,expect} from 'vitest'
import {groupedOpenness,opennessBands} from '../src/firework/butterfly-openness-diversity.js'
import {sampleDiverseButterflies} from '../src/firework/butterfly-diversity.js'
it('only openness differs, deterministic bounded weighted states',()=>{const d=groupedOpenness();expect(d).toEqual(groupedOpenness());const angles=sampleDiverseButterflies().samples;for(let i=0;i<20;i++){for(const key of ['yaw','pitch','roll']){expect(d.samples[i][key]).toBe(angles[i][key]);expect(d.before[i][key]).toBe(angles[i][key])}const b=opennessBands.find(b=>b.name===d.samples[i].state);expect(d.samples[i].openness).toBeGreaterThanOrEqual(b.min);expect(d.samples[i].openness).toBeLessThanOrEqual(b.max)}})

it('front-only filter uses front projection and preserves all four continuous bands',()=>{const d=groupedOpenness(6062,100,{front:true});expect(d.unresolved).toHaveLength(0);for(const v of d.samples){expect([v.yaw,v.pitch,v.roll]).toEqual([0,0,0])}expect(Object.values(d.counts).every(n=>n>0)).toBe(true);for(const band of opennessBands){const values=d.samples.filter(v=>v.state===band.name).map(v=>v.openness);expect(new Set(values).size).toBe(values.length)}})
