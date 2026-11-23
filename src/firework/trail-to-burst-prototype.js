// Shared trail-to-burst animation; the standalone preview uses the same factory.
import{createBurstCandidate,sampleBurstParticle}from'./burst-candidate.js'
import{sampleHead}from'./head-candidate.js'
import{trailPosition}from'./trail-candidate.js'
import{createCandidateLifecycle,stopCandidateHead,lifecycleSnapshot}from'./candidate-lifecycle.js'
import{paintFinalTip}from'./final-tip-clusters.js'
export function createTrailToBurst(seed=1201,{type='flower',starVariant='eight',sourceCandidate=null}={}){
 if(!['flower','star','butterfly','natural'].includes(type))throw new Error('Unknown prototype type')
 if(!['four','eight'].includes(starVariant))throw new Error('Only four/eight stars are supported')
 const source=sourceCandidate??createBurstCandidate(seed),trail={...source.trail},base=sourceCandidate?{...source,trail,trigger:{...source.trigger,lifecycle:createCandidateLifecycle(trail)}}:source,plan=base.trigger.plans.find(p=>p.spec!=='fine'&&p.position.y< -80)??base.trigger.plans.at(-1)
 if(!plan)throw new Error('Seed has no eligible secondary burst')
 const head=base.trail.head.heads[plan.headId];stopCandidateHead(base.trigger.lifecycle,head.id,plan.time)
 const trails=base.trail.particles.filter(p=>p.headId===head.id&&p.birth<plan.time).map(p=>({...p,life:p.life+.55})),children=base.particles.filter(p=>p.eventId===head.id).map((p,i)=>({...p,type:i%4===0?'flower':'ordinary',size:i%4===0?6+(i%3)*3:Math.min(.7,p.size),life:p.life+(i%4===0?.18:0)}))
 if(type!=='flower')children.forEach((p,i)=>{if(i%4===0){p.type=type==='star'?(i%8===0?'eight':'four'):type==='butterfly'?'butterfly':i%8===0?'spindle':'shard';if(p.type==='eight'||p.type==='four')p.size*=p.type==='eight'?1.65:1.4}else if(type==='butterfly'&&i%3===0)p.displayKind='spindle';else if(type==='natural')p.displayKind=['shard','spindle','spark'][i%3]})
 base.trail.particles=trails;return{seed,type,heroKind:type==='star'?starVariant:type==='natural'?'spindle':type,base,plan,head,trails,children,heroStart:Math.max(head.birth,.4),heroFull:.67,burstTime:plan.time,duration:Math.max(...children.map(p=>p.birth+p.life),...trails.map(p=>p.birth+p.life))+.45,points:trails.map(()=>({x:0,y:0,width:0,alpha:0,valid:false})),flowerBuffer:{x:0,y:0,angle:0,finalKind:'flower',finalRotation:0,finalDiameter:0,finalAlpha:0},fragmentBuffer:{x:0,y:0,size:1,angle:0,shape:0,brightness:1}}
}
export function prototypeStage(c,t){if(t<c.head.birth)return'Ready';if(t<c.heroStart)return'Trail';if(t<c.burstTime)return`Hero ${c.type}`;if(t<Math.max(...c.children.map(p=>p.birth+p.life)))return'Secondary Burst';return'Fade / Reset'}
export function prototypeHero(c,t){const p=sampleHead(c.head,Math.min(t,c.burstTime)),grow=Math.max(0,Math.min(1,(t-c.heroStart)/(c.heroFull-c.heroStart))),fade=Math.min(1,Math.max(0,(c.burstTime-t)/.045));return{...p,visible:t>=c.heroStart&&t<c.burstTime,diameter:32*grow*(c.heroKind==='eight'?1.5:c.heroKind==='four'?1.25:1),alpha:grow*fade}}
function ribbon(ctx,points){if(points.length<2)return;const first=points[0],last=points.at(-1),g=ctx.createLinearGradient(first.x,first.y,last.x,last.y);points.forEach((p,i)=>g.addColorStop(i/(points.length-1),`rgba(245,220,234,${p.alpha*.65})`));ctx.fillStyle=g;ctx.shadowBlur=0;ctx.beginPath();for(const side of[1,-1]){for(let k=0;k<points.length;k++){const i=side===1?k:points.length-1-k,p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.max(.01,Math.hypot(b.x-a.x,b.y-a.y)),x=p.x-(b.y-a.y)/d*p.width*side,y=p.y+(b.x-a.x)/d*p.width*side;if(side===1&&k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}}ctx.closePath();ctx.fill();ctx.globalAlpha=.75;ctx.shadowBlur=2;ctx.lineWidth=.7;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.globalAlpha=1}
export function paintTrailToBurst(ctx,c,time,{bodyPainter=null,shapePainter=paintFinalTip}={}){
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='#f5dcea';ctx.strokeStyle='#fff6ef';ctx.shadowColor='#d4b8ee';ctx.shadowBlur=2;ctx.lineCap='round';ctx.lineJoin='round';let visibleTrails=0;if(bodyPainter){visibleTrails=bodyPainter(ctx,c,time)}else{const active=[];let previous=null
 for(let i=0;i<c.trails.length;i++){const p=c.trails[i],q=c.points[i],age=time-p.birth;q.valid=age>=0&&age<p.life;if(!q.valid){previous=null;continue}const pos=trailPosition(p,time),fade=Math.pow(1-age/p.life,1.2),u=(p.birth-c.head.birth)/(c.burstTime-c.head.birth);const center=sampleHead(c.head,p.birth);q.x=center.x+pos.x-p.x;q.y=center.y+pos.y-p.y;q.width=(.75+11*Math.pow(u,1.4))*Math.pow(fade,.3);q.alpha=fade;visibleTrails++;active.push(q);previous=q}
 // Connect the newest historical sample to the unchanged moving head before the event.
 if(previous&&time<c.burstTime&&time>=c.head.birth){const h=sampleHead(c.head,time),u=Math.min(1,(time-c.head.birth)/(c.burstTime-c.head.birth));active.push({...h,width:.75+11*Math.pow(u,1.4),alpha:1})}
 ribbon(ctx,active)}ctx.shadowBlur=0;ctx.globalAlpha=1;const hero=prototypeHero(c,time),q=c.flowerBuffer
 if(hero.visible){Object.assign(q,{x:hero.x,y:hero.y,finalKind:c.heroKind,finalDiameter:hero.diameter,finalAlpha:hero.alpha*.93,finalRotation:-.15+(time-c.heroStart)*.15});shapePainter(ctx,q,'#d4b8ee',-1)}
 let activeChildren=0
 for(let index=0;index<c.children.length;index++){const p=c.children[index],s=sampleBurstParticle(p,time);if(!s.visible)continue;activeChildren++;if(p.type!=='ordinary'){Object.assign(q,{x:s.x,y:s.y,finalKind:p.type,finalDiameter:p.size*Math.min(1,s.age/.065),finalAlpha:s.alpha*.88,finalRotation:p.angle+p.rotation*s.age});shapePainter(ctx,q,p.color,index)}else{Object.assign(q,{x:s.x,y:s.y,finalKind:p.displayKind??(p.shape===1?'spark':'shard'),finalDiameter:p.size*6*Math.sqrt(s.alpha),finalAlpha:s.alpha*.86,finalRotation:p.angle+p.rotation*s.age});shapePainter(ctx,q,p.color,index)}}

 ctx.restore();return{stage:prototypeStage(c,time),visibleTrails,activeChildren,heroVisible:hero.visible,complete:time>=c.duration}
}
export function prototypeSnapshot(c,t){return{stage:prototypeStage(c,t),hero:prototypeHero(c,t),children:c.children.map(p=>sampleBurstParticle(p,t)),trails:lifecycleSnapshot(c.base.trigger.lifecycle,t).trails.filter(p=>p.headId===c.head.id)}}
