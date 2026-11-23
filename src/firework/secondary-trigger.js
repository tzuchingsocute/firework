// Candidate trigger mechanism only; reuses unchanged Head, Trail and lifecycle APIs.
import {sampleHead} from './head-candidate.js'
import {createCandidateLifecycle,stopCandidateHead,addCandidateBurst} from './candidate-lifecycle.js'
export function createSecondaryTrigger(candidate){
 const lifecycle=createCandidateLifecycle(candidate),plans=[]
 const eligible=candidate.head.heads.filter(h=>candidate.head.tail.peak.strokes[h.id].spec!=='fine')
 // Fixed seed selection: one representative in each requested launch sector.
 const sectors=[h=>h.initialVelocity.y< -Math.abs(h.initialVelocity.x)*1.5,h=>h.initialVelocity.y<0&&Math.abs(h.initialVelocity.x)>Math.abs(h.initialVelocity.y)*.45,h=>Math.abs(h.initialVelocity.y)<Math.abs(h.initialVelocity.x)*.3]
 const used=new Set()
 for(const matches of sectors){const options=eligible.filter(h=>matches(h)&&!used.has(h.id)).sort((a,b)=>(candidate.head.tail.peak.strokes[a.id].spec==='bold'?0:1)-(candidate.head.tail.peak.strokes[b.id].spec==='bold'?0:1));const h=options[0];if(!h)continue;used.add(h.id)
  const minAge=.7+(h.id%5)*.065;let trigger=null
  for(let age=minAge;age<h.duration-.03;age+=.005){const p=sampleHead(h,h.birth+age),speed=Math.hypot(p.vx,p.vy),initial=Math.hypot(h.initialVelocity.x,h.initialVelocity.y);if(p.vy>8&&speed<initial*.75){trigger=h.birth+age;break}}
  if(trigger!==null){const p=sampleHead(h,trigger);plans.push({headId:h.id,time:trigger,position:{x:p.x,y:p.y},velocity:{x:p.vx,y:p.vy},direction:Math.atan2(p.vy,p.vx),color:h.color,spec:candidate.head.tail.peak.strokes[h.id].spec})}
 }
 plans.sort((a,b)=>a.time-b.time)
 return {candidate,lifecycle,plans,events:[],fired:new Set()}
}
export function updateSecondaryTrigger(state,time){
 for(const plan of state.plans){if(time<plan.time||state.fired.has(plan.headId))continue
  state.fired.add(plan.headId);state.events.push({...plan});stopCandidateHead(state.lifecycle,plan.headId,plan.time)
  for(let i=0;i<7;i++){const a=i*2.39+plan.headId,speed=16+(i%3)*9;addCandidateBurst(state.lifecycle,{headId:plan.headId,birth:plan.time,life:.22+i*.025,velocity:{x:Math.cos(a)*speed,y:Math.sin(a)*speed},inherit:.3,gravity:24,drag:2})}
 }
 return state.events
}
