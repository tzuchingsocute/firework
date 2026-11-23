// Lifecycle bookkeeping only. No formal controller imports or visual changes.
import {sampleHead} from './head-candidate.js'
export function createCandidateLifecycle(candidate){return {candidate,headStops:new Map(),bursts:[],disposed:false}}
export function stopCandidateHead(state,id,time){
 if(state.disposed)throw new Error('Candidate disposed')
 const h=state.candidate.head.heads.find(h=>h.id===id);if(!h)throw new Error('Unknown head')
 state.headStops.set(id,Math.min(state.headStops.get(id)??Infinity,Math.max(h.birth,time)))
}
export function addCandidateBurst(state,{headId,birth,life,velocity={x:0,y:0},inherit=.35,gravity=20,drag=2}){
 if(!(life>0))throw new Error('Burst lifetime must be positive')
 if(state.disposed)throw new Error('Candidate disposed')
 const h=state.candidate.head.heads.find(h=>h.id===headId);if(!h)throw new Error('Unknown head')
 const p=sampleHead(h,Math.min(birth,state.headStops.get(headId)??Infinity)),b={birth,life,x:p.x,y:p.y,vx:p.vx*inherit+velocity.x,vy:p.vy*inherit+velocity.y,gravity,drag}
 state.bursts.push(b);return b
}
export function lifecycleSnapshot(state,time){
 if(state.disposed)return {heads:[],trails:[],bursts:[],end:0,complete:true}
 const c=state.candidate,headEnd=h=>Math.min(h.birth+h.duration,state.headStops.get(h.id)??Infinity)
 const heads=c.head.heads.filter(h=>time>=h.birth&&time<headEnd(h))
 const trails=c.particles.filter(p=>p.birth<headEnd(c.head.heads[p.headId])&&time>=p.birth&&time<p.birth+p.life)
 const bursts=state.bursts.filter(p=>time>=p.birth&&time<p.birth+p.life)
 // Future scheduled emissions also keep the instance alive until their own end.
 const end=Math.max(0,...c.head.heads.map(headEnd),...c.particles.filter(p=>p.birth<headEnd(c.head.heads[p.headId])).map(p=>p.birth+p.life),...state.bursts.map(p=>p.birth+p.life))
 return {heads,trails,bursts,end,complete:time>=end}
}
export function disposeCandidateLifecycle(state,time){if(!lifecycleSnapshot(state,time).complete)return false;state.bursts.length=0;state.headStops.clear();state.disposed=true;return true}
