import { expect, it } from 'vitest'
import { handGeometry } from '../src/hand/model.js'
import { stepDrops } from '../src/surface/physics.js'

const points = [
  [.50,.70],[.44,.65],[.40,.62],[.36,.58],[.33,.55],
  [.45,.51],[.44,.44],[.43,.38],[.42,.32],
  [.50,.48],[.50,.40],[.50,.32],[.50,.25],
  [.55,.50],[.56,.43],[.57,.37],[.58,.32],
  [.59,.54],[.61,.49],[.63,.45],[.65,.42],
]
const hand = (side, dx=0) => ({side,score:.95,landmarks:points.map(([x,y])=>({x:x+dx,y}))})
const view = {width:414,height:233,videoWidth:1280,videoHeight:720,fit:'contain'}
const zero = {x:0,y:0,z:0}
const palm = {id:'hand-Left-palm',hand:'palm',center:{x:120,y:95,z:0},radius:{x:26,y:18,z:6},angle:0,velocity:zero}
const rain = (x=120,y=25,vx=0) => ({id:1,position:{x,y,z:0},velocity:{x:vx,y:2200,z:0},state:'free',life:2,radius:1})

it('projects mirrored palms and segmented fingers and tracks two hands through re-entry',()=>{
  const first=handGeometry([hand('Left'),hand('Right',.2)],view,null,0)
  expect(first.hands.size).toBe(2)
  const left=first.hands.get('Left')
  expect(left.points[0].x).toBeCloseTo(207)
  expect(left.patches.filter(p=>p.hand==='finger')).toHaveLength(15)
  expect(left.patches[0].center.y).toBeCloseTo(137.5,0)
  const moving=handGeometry([hand('Left',.08)],view,first,55)
  expect(moving.hands.get('Left').patches[0].velocity.x).toBeLessThan(-100)
  expect(moving.hands.has('Right')).toBe(false)
  const recovered=handGeometry([hand('Right',.2)],view,moving,110)
  expect(recovered.hands.get('Right').patches[0].velocity).toEqual(zero)
})
it('sweeps a fast drop through the palm before a lower head, then keeps attachment in local coordinates',()=>{
  const head={...palm,id:'head',hand:undefined,center:{x:120,y:135,z:0}}
  const hits=[]
  const result=stepDrops([rain()], [head,palm], .06, ()=>true, undefined,undefined,undefined,{kinematic:true,onImpact:(_,__,id)=>hits.push(id)})
  expect(hits).toEqual([palm.id])
  expect(result[0]).toMatchObject({state:'attached',patch:palm.id})
  expect(result.filter(p=>p.splash)).toHaveLength(2)
  const moved={...palm,center:{...palm.center,x:131},angle:.4}
  stepDrops([result[0]],[moved],.04)
  expect(result[0].position.x).toBeGreaterThan(125)
  expect(stepDrops([result[0]],[],.04)).toHaveLength(0)
})
it('weakens finger splashes and transfers real palm velocity to flyaway drops',()=>{
  const finger={...palm,hand:'finger',id:'hand-Left-finger-8'}
  const result=stepDrops([rain()],[finger],.06)
  expect(result[0].state).toBe('free')
  expect(result.filter(p=>p.splash)).toHaveLength(1)
  const moving={...palm,center:{...palm.center,x:130},previous:palm,motionDt:.035,
    velocity:{x:285,y:0,z:0},acceleration:{x:1500,y:0,z:0}}
  const held={...rain(),state:'attached',patch:moving.id,uv:{x:0,y:-1,z:0},age:.12,velocity:zero}
  const released=stepDrops([held],[moving],.02)
  expect(released[0].state).toBe('free')
  expect(released[0].velocity.x).toBeGreaterThan(100)
})

it('keeps a thin horizontal palm active and picks the actual first contact over the shoulder', () => {
  const flat = hand('Left')
  for (const index of [0, 5, 9, 13, 17]) flat.landmarks[index].y = index === 0 ? .56 : .55
  const shape = handGeometry([flat], view, null, 0).hands.get('Left').patches.find(p => p.hand === 'palm')
  expect(shape.radius.y).toBeGreaterThan(0)
  expect(shape.radius.y).toBeLessThan(shape.radius.x * .3)
  const shoulder = { ...palm, id: 'left-shoulder', hand: undefined,
    center: { ...shape.center, y: shape.center.y + 32 } }
  const hitIds = (surfaces, x) => {
    const hits = []
    stepDrops([rain(x, shape.center.y - 65)], surfaces, .06, () => true, undefined, undefined, undefined,
      { kinematic: true, onImpact: (_, __, id) => hits.push(id) })
    return hits
  }
  expect(hitIds([shoulder, shape], shape.center.x)).toEqual([shape.id])
  expect(hitIds([shape, { ...shoulder, center: { ...shoulder.center, y: shape.center.y - 32 } }], shape.center.x)).toEqual([shoulder.id])
  expect(hitIds([shoulder], shape.center.x)).toEqual([shoulder.id])
  expect(handGeometry([hand('Left', 2)], view, null, 0).hands.size).toBe(0)
})

it('prevents a spent palm drop from causing another impact after detach', () => {
  const spent = { ...rain(), noFurtherImpact: true }
  let contacts = 0
  const result = stepDrops([spent], [{ ...palm, hand: undefined, id: 'left-shoulder' }], .06,
    () => true, undefined, undefined, undefined, { onImpact: () => contacts++ })
  expect(contacts).toBe(0)
  expect(result).toHaveLength(1)
})

it('uses only a spatially matched Pose wrist for conservative shoulder visibility ordering', async () => {
  const { shoulderOcclusion, obscuringPalm, overlapsAt } = await import('../src/hand/occlusion.js')
  const shoulder = { ...palm, id:'left-shoulder', center:{x:120,y:105,z:0} }
  const depth = z => ({ wrists:[{x:120,y:95,z,visibility:.95}], shoulders:{'left-shoulder':{z:0,visibility:.95}} })
  const front=shoulderOcclusion([palm],[shoulder],depth(-.2))
  expect(front[0]).toMatchObject({ order:'FRONT', opacity:0 })
  expect(overlapsAt(front[0],{x:120,y:100})).toBe(true)
  expect(obscuringPalm(front,shoulder.id,{x:120,y:100},4)).toBe(front[0])
  expect(obscuringPalm(front,shoulder.id,{x:205,y:100},4)).toBeUndefined()
  expect(shoulderOcclusion([palm],[shoulder],depth(.2))[0]).toMatchObject({ order:'BEHIND', opacity:1 })
  expect(shoulderOcclusion([palm],[shoulder],null)[0]).toMatchObject({ order:'UNCERTAIN', opacity:.35 })
  expect(shoulderOcclusion([],[shoulder],depth(-.2))).toHaveLength(0)
})

it('records palm rejection and interpolates tilted moving contact in the video frame', () => {
  const moving = { ...palm, angle:.2, velocity:{x:150,y:0,z:0} }
  const candidates = []
  const impacts = []
  stepDrops([rain()],[moving],.06,()=>true,undefined,undefined,undefined,{
    kinematic:true,candidate:(_,reason,t,point)=>candidates.push({reason,t,point}),
    onImpact:(_,point)=>impacts.push(point),
  })
  expect(candidates[0].reason).toBe('contact')
  expect(candidates[0].t).toBeGreaterThan(0)
  expect(impacts[0].x).toBeCloseTo(120)
  candidates.length=0
  stepDrops([rain()],[moving],.06,()=>true,undefined,undefined,undefined,{
    kinematic:true,handVisible:()=>false,candidate:(_,reason)=>candidates.push({reason}),
  })
  expect(candidates).toEqual([{reason:'outside-visible-surface'}])
})

it('uses foreground evidence only to break simultaneous palm and shoulder contacts', () => {
  const shoulder = { ...palm, id:'left-shoulder', hand:undefined }
  const chosen = prefer => {
    const hits = []
    const [first] = stepDrops([rain(120,95)],[shoulder,palm],.02,()=>true,undefined,undefined,undefined,{
      kinematic:true,preferCoincidentPalm:prefer,onImpact:(_,point,id)=>hits.push({point,id}),
    })
    expect(first.state).toBe('attached')
    return hits[0]
  }
  expect(chosen(()=>false).id).toBe('left-shoulder')
  const contact = chosen((candidate,current)=>candidate.hand==='palm'&&current.id==='left-shoulder')
  expect(contact.id).toBe(palm.id)
  expect(contact.point.y).toBeCloseTo(77)
})
