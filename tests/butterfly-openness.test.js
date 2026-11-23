import {it,expect} from 'vitest'
import {butterflyGeometry,wingCurves} from '../src/firework/butterfly-shape.js'
import {wingCurves as before} from './fixtures/butterfly-before-openness.js'
it('unchanged source contours and continuous hinge mapping',()=>{expect(wingCurves).toEqual(before);for(const yaw of [-40,0,40])for(let o=0;o<1;o+=.02){const a=butterflyGeometry({yaw,openness:o}),b=butterflyGeometry({yaw,openness:o+.001});for(const s of a){const t=b.find(t=>t.side===s.side&&t.wing===s.wing);for(let i=0;i<s.points.length;i++)expect(Math.hypot(s.points[i].x-t.points[i].x,s.points[i].y-t.points[i].y)).toBeLessThan(.5)}}})
