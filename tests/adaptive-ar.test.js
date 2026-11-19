import { expect, it } from 'vitest'
import { adaptiveContact, createAdaptiveRegions, hairEdges, faceEdges } from '../src/rain/adaptive.js'
import { stepDrops } from '../src/surface/physics.js'

const rect = { x:0, y:30, width:100, height:180 }
const hair = { x:0, step:5, values:Float32Array.from([NaN,31,31,31,32,35,35,35,NaN]) }
const face = { center:50, margin:4, points:[{x:35,y:66},{x:50,y:55},{x:65,y:66},{x:70,y:110},{x:50,y:130},{x:30,y:110}] }

it('uses supported visible hair columns and excludes offscreen head edges', () => {
  expect(hairEdges(hair, rect).length).toBeGreaterThan(0)
  expect(hairEdges(hair, { ...rect, y:36 })).toHaveLength(0)
  expect(hairEdges({ ...hair, values:[NaN,31,NaN,31] }, rect)).toHaveLength(0)
})
it('smoothly transitions from complete crown to visible hair and a hair-free face, then clears loss', () => {
  const update=createAdaptiveRegions()
  const full={ key:'same', patches:[{id:'head'}], hairBoundary:hair, face, headBounds:{left:0,right:100,top:65,bottom:120} }
  const mounted=update(full,rect,1,1000)
  expect(mounted.weights.crown).toBeGreaterThan(.95)
  const clipped={ ...full, patches:[],headBounds:{...full.headBounds,top:30} }
  const early=update(clipped,rect,.016,1016)
  expect(early.weights.hair).toBeLessThan(.15)
  expect(early.weights.crown).toBeGreaterThan(.8)
  expect(update(clipped,rect,1,2016).weights.hair).toBeGreaterThan(.7)
  const noHair=update({...clipped,hairBoundary:null},rect,1,3016)
  expect(noHair.weights.face).toBeGreaterThan(.9)
  const missing=update({key:'same',patches:[]},rect,.016,3032)
  expect(missing.face).toHaveLength(0)
  expect(missing.hair).toHaveLength(0)
  expect(update(full,rect,1,4032).crown).toBe(true)
})
it('deflects only along reliable side contours and leaves the face core clear of contacts', () => {
  const edges=faceEdges(face,rect)
  const regions={hair:[],face:edges,center:50,weights:{face:1,hair:0}}
  const from={x:25,y:72,z:0}, to={x:25,y:130,z:0}
  const contact = adaptiveContact(regions,from,to,()=>false)
  expect(contact.kind).toBe('face')
  expect(contact.direction).toBe(-1)
  expect(adaptiveContact(regions,{...from,x:50},{...to,x:50},()=>false)).toBeUndefined()
  expect(adaptiveContact(regions,from,to,()=>true)).toBeUndefined()
  const [drop,...splash]=stepDrops([{state:'free',life:1,position:from,velocity:{x:0,y:580,z:0}}],[],.1,
    undefined,undefined,undefined,undefined,{kinematic:true,deflect:(a,b)=>adaptiveContact(regions,a,b,()=>false)})
  expect(drop.velocity.x).toBeLessThan(0)
  expect(splash).toHaveLength(0)
})

it('finds the first visible hair row when the top of the source is cropped out', async () => {
  const { buildSurface } = await import('../src/surface/model.js')
  const mask = new Uint8Array(200)
  for (let row=0;row<9;row++) for (let x=2;x<8;x++) mask[row*10+x]=1
  const frame = {videoWidth:100,videoHeight:200,mode:'cover',maskWidth:10,maskHeight:20,mask,time:0}
  const diagnostics={}
  buildSurface(frame,100,100,undefined,diagnostics)
  expect(diagnostics.active).toBe(false)
  expect(diagnostics.hairBoundary.values[4]).toBeLessThan(0)
  expect(diagnostics.visibleHairBoundary.values[4]).toBeGreaterThanOrEqual(0)
})

it('moves the hair contact with the tracked columns and misses the previous location', () => {
  const update = createAdaptiveRegions()
  const scene = { key:'motion', patches:[], hairBoundary:hair }
  const initial = update(scene, rect, 1, 1000)
  const moved = update({...scene,hairBoundary:{...hair,x:50}},rect,.016,1016)
  const hit = (regions,x) => adaptiveContact(regions,{x,y:30,z:0},{x,y:48,z:0},()=>false)
  expect(hit(initial,20)?.kind).toBe('hair')
  expect(hit(moved,20)).toBeUndefined()
  expect(hit(moved,70)?.kind).toBe('hair')
})
