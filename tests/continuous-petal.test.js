import {it,expect} from 'vitest'
import {createPetalContour,continuousPetalPresets} from '../src/firework/continuous-petal.js'
it('closed continuous curves with matching tangent directions',()=>{for(const config of Object.values(continuousPetalPresets)){const s=createPetalContour(config);for(let i=0;i<s.length;i++){const [a,b,c,d]=s[i],next=s[(i+1)%s.length];expect(d).toEqual(next[0]);const u=[d[0]-c[0],d[1]-c[1]],v=[next[1][0]-d[0],next[1][1]-d[1]];expect(Math.abs(u[0]*v[1]-u[1]*v[0])).toBeLessThan(.000001)}}})
