import {it,expect} from 'vitest'
import {rootTransition} from '../src/firework/petal-root-transition.js'
import {narrowedPetal} from '../src/firework/flower-negative-space.js'
it('root-only controls; fixed anchors and outer curves',()=>{const old=narrowedPetal('B');for(const v of ['A','B','C']){const s=rootTransition(v);expect(s[1]).toEqual(old[1]);expect(s[2]).toEqual(old[2]);for(const [i,j]of [[0,0],[0,2],[0,3],[3,0],[3,1],[3,3],[4,0],[4,3]])expect(s[i][j]).toEqual(old[i][j]);expect(s[0][1][0]).toBeLessThan(0);expect(s[3][2][0]).toBeGreaterThan(0)}})
