import {it,expect} from 'vitest'
import {elongatedContour,projectElongated,mixedStars} from '../src/firework/elongated-star.js'
it('source elongation separate from bounded perspective and stable mixing',()=>{const c=elongatedContour();expect(c).toHaveLength(192);expect(Math.max(...c.map(p=>p.y))).toBeGreaterThan(Math.max(...c.map(p=>p.x))*2);expect(mixedStars()).toEqual(mixedStars());expect(mixedStars().filter(s=>!s.classic)).toHaveLength(4);for(const v of mixedStars())expect(projectElongated(v,v).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true)})
