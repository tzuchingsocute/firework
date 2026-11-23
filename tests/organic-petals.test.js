import {it,expect} from 'vitest'
import {organicPetal} from '../src/firework/organic-petals.js'
it('equal lengths, closed paths and distinct outer curvature',()=>{for(const t of ['A','B','C']){const s=organicPetal(t);expect(s[1][3][1]).toBe(1);expect(s[4][3]).toEqual(s[0][0]);for(let i=0;i<4;i++)expect(s[i][3]).toEqual(s[i+1][0])}expect(organicPetal('A')).not.toEqual(organicPetal('B'));expect(organicPetal('B')).not.toEqual(organicPetal('C'))})
