import {it,expect} from 'vitest'
import {sampleDiverseButterflies,projectionMetrics} from '../src/firework/butterfly-diversity.js'
import {seededButterflies} from '../src/firework/butterfly-shape.js'
it('stable grouped orientations with fixed and original openness',()=>{const a=sampleDiverseButterflies();expect(a).toEqual(sampleDiverseButterflies());expect(a.samples).toHaveLength(20);for(const v of a.samples){expect(v.openness).toBe(.7);expect(projectionMetrics(v).width/projectionMetrics(v).height).toBeGreaterThan(.22)}expect(sampleDiverseButterflies(6062,20,{existingOpenness:true}).samples.map(v=>v.openness)).toEqual(seededButterflies(6062,20).map(v=>v.openness))})
