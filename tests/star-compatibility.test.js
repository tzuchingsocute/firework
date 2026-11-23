import {it,expect} from 'vitest'
import {projectCompatibleStar,compatibilityViews,starGeometry} from '../src/firework/star-compatibility.js'
import {projectStar as previous} from './fixtures/star-perspective-before-shared.js'
it('classic projection exactly preserved; both types finite through continuous rotation',()=>{for(const v of compatibilityViews)expect(projectCompatibleStar('four',v)).toEqual(previous(v));expect(()=>starGeometry('six')).toThrow();for(let angle=-60;angle<=60;angle++){const p=projectCompatibleStar('eight',{yaw:angle,pitch:angle*.5,roll:angle*.2});expect(p.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true)}})
