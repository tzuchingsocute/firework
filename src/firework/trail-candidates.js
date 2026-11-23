import {grainTexture} from './trail-material.js'
const hash=n=>(Math.imul(n+17,0x85ebca6b)>>>0)/4294967296
// Material-local samples are prepared once, fixed to the curve for the entire playback.
const samples=new Map()
export function candidateSamples(seed=1){
 if(samples.has(seed))return samples.get(seed)
 const centers=Array.from({length:6},(_,i)=>(i+hash(seed*31+i)*.8)/6)
 const result=Array.from({length:60},(_,i)=>{
  const group=i%6,n=hash(seed*73+i),spread=.018+hash(group+seed)*.04
  return {u:Math.max(0,Math.min(1,centers[group]+(n-.5)*spread*2)),side:(hash(i*17+seed)-.5)*3.8,size:.4+hash(i*43+seed)*1.1,bright:.45+hash(i*29+seed)*.55}
 }).sort((a,b)=>a.u-b.u)
 samples.set(seed,result);return result
}
export function paintTrailCandidate(ctx,progress,variant,{angle=-.75,length=145,bend=18,color='#f5dfac',seed=1,weight=1}={}){
 if(progress<=0||progress>=1)return
 const head=1-Math.pow(1-progress,2.1),tail=Math.max(0,head-.52)
 const fade=Math.min(1,progress/.12,(1-progress)/.22)*weight
 const point=u=>({x:Math.cos(angle)*length*u+Math.sin(angle)*bend*u*u,y:Math.sin(angle)*length*u+Math.cos(angle)*bend*u*u+8*u*u})
 const sprite=grainTexture(color),data=candidateSamples(seed)
 ctx.save()
 // One filled irregular ribbon, not a chain of circular stamps or uniform stroke.
 const edges=[[],[]]
 for(let i=0;i<=40;i++){
  const u=tail+(head-tail)*i/40,p=point(u),n=hash(Math.floor(u*110)+seed*11)
  const w=(.12+.85*(i/40)**1.1)*(.55+n*.65)*(variant==='A'?1.65:.85)
  edges[0].push({x:p.x+Math.sin(angle)*w,y:p.y-Math.cos(angle)*w})
  edges[1].push({x:p.x-Math.sin(angle)*w*.75,y:p.y+Math.cos(angle)*w*.75})
 }
 const from=point(tail),to=point(head),gradient=ctx.createLinearGradient(from.x,from.y,to.x,to.y)
 gradient.addColorStop(0,'rgba(225,235,240,0)');gradient.addColorStop(.35,color);gradient.addColorStop(.8,'#f0eee0');gradient.addColorStop(1,'#fffdf3')
 ctx.fillStyle=gradient;ctx.globalAlpha=fade*(variant==='A'?.8:.3)
 ctx.beginPath();[...edges[0],...edges[1].reverse()].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill()
 if(variant!=='A')for(let i=0;i<data.length;i++){
  const d=data[i];if(d.u<tail||d.u>head)continue
  const p=point(d.u),relative=(d.u-tail)/(head-tail),x=p.x+Math.sin(angle)*d.side,y=p.y-Math.cos(angle)*d.side
  if(variant==='C'&&d.bright>.8){ctx.globalAlpha=fade*relative*.4;const r=d.size*5;ctx.drawImage(sprite,x-r,y-r,r*2,r*2)}
  ctx.globalAlpha=fade*relative*d.bright;ctx.fillStyle=i%3===0?'#fffdf3':color
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(1.35,1.35)
  ctx.beginPath();ctx.moveTo(-d.size*.8,-d.size*.18);ctx.quadraticCurveTo(0,-d.size*.7,d.size*1.3,0);ctx.lineTo(d.size*.2,d.size*.5);ctx.lineTo(-d.size*.65,d.size*.25);ctx.closePath();ctx.fill();ctx.restore()
 }
 // Short asymmetric splinters merge the tip with the ribbon, avoiding a round brush head.
 for(let i=0;i<5;i++){
  const p=point(Math.max(tail,head-i*.006)),side=(hash(i+seed)-.5)*2
  ctx.globalAlpha=fade*(.8-i*.1);ctx.fillStyle='#faf7eb'
  ctx.save();ctx.translate(p.x+Math.sin(angle)*side,p.y-Math.cos(angle)*side);ctx.rotate(angle);ctx.scale(1.35,1.35)
  ctx.beginPath();ctx.moveTo(-2.5-i*.12,-.3);ctx.lineTo(1.8,.05);ctx.lineTo(-.8,.65);ctx.closePath();ctx.fill();ctx.restore()
 }
 ctx.restore()
}
