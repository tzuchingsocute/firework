import {projectCompatibleStar} from './star-compatibility.js'
import {butterflyGeometry} from './butterfly-shape.js'
import {createOrganicFlower} from './organic-flower-count.js'
import {spatialSurfaces} from './flower-perspective-diversity.js'

export const tipFamilies=['star','butterfly','flower','natural']
function random(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
// Independent render seed: does not consume any motion, ending or composition RNG.
export function finalTipSample(seed,index,progress,family){
 const r=random((seed^Math.imul(index+1,0x9e3779b1))>>>0),pick=r(),band=pick<.16?'large':pick<.66?'medium':'small',diameter=(band==='large'?26:band==='medium'?14:5)*(.85+r()*.3),u=Math.max(0,Math.min(1,progress)),envelope=.18+.82*Math.sin(Math.min(1,u/.55)*Math.PI/2)
 const shaped=family!=='natural'&&u>.12&&r()<.32,kind=shaped?(family==='star'?(r()<.35?'eight':'four'):family):family==='butterfly'?'spindle':r()<.5?'shard':'spark'
 // Irregular pockets, with a bounded lateral footprint. Large sizes are not tied to birth order.
 return{band,kind,diameter:diameter*envelope*(shaped?(kind==='eight'?1.12:1):.45),side:(r()-.5)*26*envelope,along:-(r()*23+3)*envelope,rotation:(r()-.5)*1.2,drift:(r()-.5)*10}
}
export function configureFinalTips(trail,seed,selected){
 for(const id of selected){const h=trail.head.heads[id],r=random(seed^Math.imul(id+7,0x85ebca6b)),family=tipFamilies[Math.floor(r()*4)];Object.defineProperty(h,'finalTipFamily',{value:family});let index=0
  for(const p of trail.particles)if(p.headId===id){const u=(p.birth-h.birth)/h.duration;Object.defineProperty(p,'finalTip',{value:finalTipSample(seed^Math.imul(id+1,919),index++,u,family)})}
 }
}
const paths=new Map()
function normalizedPaths(kind){
 const view={yaw:0,pitch:0,roll:0};let surfaces
 if(kind==='four'||kind==='eight')surfaces=[projectCompatibleStar(kind,view,1)]
 else if(kind==='butterfly')surfaces=butterflyGeometry({...view,openness:.7},1).map(s=>s.points)
 else if(kind==='flower')surfaces=spatialSurfaces(createOrganicFlower(6312,{petalCount:5}),view,1).map(s=>s.points)
 else return null
 const all=surfaces.flat(),xmin=Math.min(...all.map(p=>p.x)),xmax=Math.max(...all.map(p=>p.x)),ymin=Math.min(...all.map(p=>p.y)),ymax=Math.max(...all.map(p=>p.y)),size=Math.max(xmax-xmin,ymax-ymin)
 return surfaces.map(ps=>ps.map(p=>({x:(p.x-(xmin+xmax)/2)/size,y:(p.y-(ymin+ymax)/2)/size})))
}
function path(kind){if(paths.has(kind))return paths.get(kind);const p=new Path2D(),surfaces=normalizedPaths(kind)
 if(surfaces)for(const points of surfaces){points.forEach((q,i)=>i?p.lineTo(q.x,q.y):p.moveTo(q.x,q.y));p.closePath()}
 else{p.moveTo(-.5,0);if(kind==='spindle'){p.bezierCurveTo(-.15,-.28,.2,-.28,.5,0);p.bezierCurveTo(.15,.28,-.2,.28,-.5,0)}else if(kind==='spark'){p.lineTo(-.1,-.06);p.lineTo(.5,.015);p.lineTo(.04,.085)}else{p.lineTo(-.09,-.29);p.lineTo(.425,-.0435);p.lineTo(.04,.232)}p.closePath()}paths.set(kind,p);return p
}
// One cached contour per existing shape; no per-frame sprites or additional live particles.
export function paintFinalTip(ctx,q,color){
 if(q.finalAlpha<=0)return;ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=q.finalAlpha;ctx.translate(q.x,q.y);ctx.rotate(q.angle+q.finalRotation);ctx.shadowColor=color;ctx.shadowBlur=1.2;ctx.fillStyle='#fff1e6';ctx.scale(q.finalDiameter,q.finalDiameter);ctx.fill(path(q.finalKind),'nonzero');ctx.restore()
}
export function positionFinalTip(q,p,age,fade){const s=p.finalTip,a=p.angle,spread=1-Math.exp(-age*13),along=s.along+age*s.drift,side=s.side*(.65+.35*spread)+s.drift*age*.8
 q.x+=Math.cos(a)*along-Math.sin(a)*side;q.y+=Math.sin(a)*along+Math.cos(a)*side
 q.finalKind=s.kind;q.finalRotation=s.rotation+age*s.drift*.025;q.finalDiameter=s.diameter*Math.pow(fade,.32);q.finalAlpha=Math.min(1,age/.035)*Math.pow(fade,.8)*.86
}
