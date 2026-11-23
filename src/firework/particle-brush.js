// Independent candidate. Never imported by the production controller.
function random(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
export function createParticleBrush(seed=1201,{stage=3}={}){
 const rng=random(seed),particles=[]
 const layoutRandom=random(Math.imul(seed,0x85ebca6b)),sector=-Math.PI+layoutRandom()*Math.PI*2
 // Nonuniform circular gap weights with explicit maximum-gap quality control.
 let gaps
 for(let attempt=0;attempt<64;attempt++){
  gaps=Array.from({length:8},()=>.35+layoutRandom()*.7)
  const sum=gaps.reduce((a,b)=>a+b,0);gaps=gaps.map(g=>g/sum*Math.PI*2)
  if(Math.max(...gaps)<1.3&&Math.min(...gaps)>.28)break
 }
 const offsets=[0];for(let i=1;i<8;i++)offsets.push(offsets[i-1]+gaps[i-1])
 function add(type,birth,x,y,vx,vy,life,size){particles.push({type,birth,x,y,vx,vy,life,size,stretch:1+rng()*1.2,angle:rng()*6.28,brightness:rng()<.14?1:.45+rng()*.4,shape:Math.floor(rng()*3)})}
 // Directions intentionally leave empty sectors and vary reach and emission duration.
 const roles=[
  [offsets[0],150,42,0],[offsets[1],110,62,.11],[offsets[2],78,50,.23],
  [offsets[3],142,58,.06],[offsets[4],104,42,.2],[offsets[5],88,53,.27],
  [offsets[6],116,60,.12],[offsets[7],108,32,.31],
 ]
 const streams=roles.map(([offset,length,budget,delay])=>({angle:sector+offset+(layoutRandom()-.5)*.06,reach:length*(.98+layoutRandom()*.04),budget,delay,bend:(layoutRandom()-.5)*22,start:0,span:0}))
 const curve=(stream,u)=>{const travel=stream.reach*(1-(1-u)**1.65);return {x:Math.cos(stream.angle)*travel+Math.sin(stream.angle)*stream.bend*u*u,y:Math.sin(stream.angle)*travel+u*u*12-Math.cos(stream.angle)*stream.bend*u*u}}
 for(const [streamIndex,stream] of streams.entries()){
  const {angle,reach,budget}=stream
  const originalStart=.02+rng()*.13,originalSpan=.29+rng()*.09
  const start=stream.delay+originalStart*.2
  const span=originalSpan*[1.05,.8,.52,1.05,.8,.52,1.05,.8][streamIndex]
  stream.start=start;stream.span=span;stream.id=`stream-${streamIndex}`;stream.structure=[2,5].includes(streamIndex)?'fragmented':[1,4,7].includes(streamIndex)?'medium':'complete'
  const pockets=Array.from({length:4},()=>rng())
  for(let i=0;i<budget;i++){
   // Correlated emission bursts: source visits dense pockets rather than equal intervals.
   const sample=Math.max(0,Math.min(1,i%3===0 ? pockets[i%4]+(rng()-.5)*.2 : (i+rng())/budget))
   const u=stream.structure==='fragmented' ? (i%3===0 ? .72+sample*.19 : .3+sample*.2) : stream.structure==='medium' ? .08+sample*.86 : sample
   const birth=start+u*span
   const travel=reach*(1-(1-u)**1.65),bend=(rng()-.5)*(1.2+Math.sin(u*3.14)*2.5)
   const center=curve(stream,u)
   const x=center.x+Math.sin(angle)*bend,y=center.y-Math.cos(angle)*bend
   const speed=3+rng()*8,lateral=(rng()-.5)*5
   add('stream',birth,x,y,Math.cos(angle)*speed+Math.sin(angle)*lateral,Math.sin(angle)*speed+Math.cos(angle)*lateral,.5+rng()*.25,.65+rng()*.85)
   Object.assign(particles.at(-1),{streamId:stream.id,pathU:u})
  }
 }
 if(stage>=2)for(const stream of streams){
  const oldStart=stream.start,oldSpan=stream.span
  stream.start=oldStart-stream.delay*.62
  stream.span=oldSpan*(stream.structure==='fragmented'?1.3:stream.structure==='complete'?.95:1.1)
  for(const p of particles)if(p.streamId===stream.id)p.birth=stream.start+(p.birth-oldStart)/oldSpan*stream.span
 }
 const freeClusters=[[-3,-2,.015],[-66,-48,.26],[43,31,.38]]
 const links=[[0,.58],[3,.84]].map(([index,u],i)=>{
  const stream=streams[index],point=curve(stream,u)
  return {clusterId:`cluster-${i+1}`,streamId:stream.id,pathU:u,x:point.x+3,y:point.y-2,arrival:stream.start+u*stream.span,delay:.025,birth:stream.start+u*stream.span+.025}
 })
 const clusters=stage>=3?[freeClusters[0],...links.map(l=>[l.x,l.y,l.birth])]:freeClusters
 for(const [clusterIndex,[x,y,start]]of clusters.entries()){
  const lobes=Array.from({length:3},()=>({x:(rng()-.5)*7,y:(rng()-.5)*5}))
  for(let i=0;i<35;i++){
   const l=lobes[i%3],a=rng()*6.28,v=i<23 ? 2+rng()*5 : 9+rng()*17
   add('cluster',start+rng()*.075,x+l.x+(rng()-.5)*3,y+l.y+(rng()-.5)*3,Math.cos(a)*v*1.35,Math.sin(a)*v*.7,.42+rng()*.25,.7+rng()*1.05)
   Object.assign(particles.at(-1),{clusterId:`cluster-${clusterIndex}`,linked:stage>=3&&clusterIndex>0})
  }
 }
 for(let i=0;i<24;i++){
  const anchor=freeClusters[i%3],a=(i%3)*1.9+rng()*.65,v=10+rng()*38
  add('scatter',.18+rng()*.43,anchor[0],anchor[1],Math.cos(a)*v,Math.sin(a)*v,.2+rng()*.4,.35+rng()*.65)
 }
 return {seed,stage,streams,clusters,links:stage>=3?links:[],particles,duration:1440,budget:particles.length}
}
const brushes=new Map()
function atlas(color){
 if(brushes.has(color))return brushes.get(color)
 const variants=Array.from({length:3},(_,shape)=>{
  const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d')
  const halo=ctx.createRadialGradient(16,16,0,16,16,15);halo.addColorStop(0,color);halo.addColorStop(.25,color);halo.addColorStop(1,'rgba(200,210,230,0)');ctx.globalAlpha=.32;ctx.fillStyle=halo;ctx.fillRect(0,0,32,32);ctx.globalAlpha=1
  ctx.fillStyle='#fbf6e8';ctx.beginPath()
  if(shape===0){ctx.moveTo(9,14);ctx.quadraticCurveTo(15,8,23,16);ctx.lineTo(17,19);ctx.lineTo(11,18)}
  else if(shape===1){ctx.moveTo(8,15);ctx.lineTo(24,13);ctx.lineTo(18,17);ctx.lineTo(12,18)}
  else{ctx.ellipse(16,16,3.5,2.2,.3,0,Math.PI*2)}
  ctx.closePath();ctx.fill();return c
 });brushes.set(color,variants);return variants
}
export function paintParticleBrush(ctx,brush,age,{type='all',color='#e5cfa4',linkedOnly=false,streamLinked=false,skipTipFragments=false}={}){
 const time=age/1000,sprites=atlas(color);let active=0
 for(const p of brush.particles){
  if(skipTipFragments&&(p.tipFragment||p.finalFragment))continue
  if(type!=='all'&&p.type!==type)continue
  if(linkedOnly&&!p.linked)continue
  if(streamLinked&&p.type!=='stream'&&!p.linked)continue
  const t=time-p.birth;if(t<0||t>=p.life)continue
  const progress=t/p.life
  const fade=Math.min(1,t/.025)*Math.min(1,(1-progress)/.42)
  const emphasis=p.type==='stream' ? .85 : p.type==='cluster' ? 1 : .65
  const x=p.x+p.vx*t,y=p.y+p.vy*t+8*t*t
  ctx.save();ctx.translate(x,y);ctx.rotate(p.angle);ctx.globalAlpha=Math.min(1,fade*(p.brightness*.65+emphasis*.5))
  const size=p.size*6;ctx.drawImage(sprites[p.shape],-size*p.stretch/2,-size/2,size*p.stretch,size);ctx.restore();active++
 }
 return active
}
