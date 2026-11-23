// Optical grain stays bound to a curve; no separate particle simulation.
const cache=new Map()
export function grainTexture(color){
 if(cache.has(color))return cache.get(color)
 const c=document.createElement('canvas');c.width=c.height=48;const ctx=c.getContext('2d')
 const g=ctx.createRadialGradient(24,24,0,24,24,23)
 g.addColorStop(0,'rgba(255,255,250,1)');g.addColorStop(.12,'rgba(255,252,240,.95)');g.addColorStop(.35,color);g.addColorStop(1,'rgba(200,210,240,0)')
 ctx.fillStyle=g;ctx.fillRect(0,0,48,48);cache.set(color,c);return c
}
const hash=n=>((Math.imul(n+17,0x85ebca6b)>>>0)/4294967296)
export function paintTexturedTrail(ctx,progress,{angle=-.75,length=145,bend=18,color='#f5dfac',seed=1,weight=1}={}){
 if(progress<=0||progress>=1)return
 const head=1-Math.pow(1-progress,2.1),tail=Math.max(0,head-.52)
 const fade=Math.min(1,progress/.12,(1-progress)/.22)*weight
 const point=u=>({x:Math.cos(angle)*length*u+Math.sin(angle)*bend*u*u,y:Math.sin(angle)*length*u+Math.cos(angle)*bend*u*u+8*u*u})
 const sprite=grainTexture(color);ctx.save()
 // Low continuous trail joins the grains without turning them into isolated dots.
 for(let j=0;j<22;j++){
  const u=tail+(head-tail)*j/22,v=tail+(head-tail)*(j+1)/22,p=point(u),q=point(v)
  ctx.strokeStyle=color;ctx.globalAlpha=fade*.32*j/22;ctx.lineWidth=.3+1.2*j/22
  ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke()
 }
 // Fixed curve coordinates prevent frame-to-frame boiling of the textured edge.
 for(let j=0;j<60;j++){
  const u=(j+hash(seed*83+j)*.5)/60;if(u<tail||u>head)continue
  const p=point(u),relative=(u-tail)/(head-tail),noise=hash(seed*37+j)
  const jitter=(noise-.5)*(.7+relative*2),r=(.5+relative*1.7)*(.65+noise*.65)
  ctx.globalAlpha=fade*relative*.85
  ctx.drawImage(sprite,p.x+jitter-r*2,p.y-jitter-r*2,r*4,r*4)
  if(noise>.5){ctx.globalAlpha=fade*relative;ctx.fillStyle='#f9faf0';ctx.beginPath();ctx.ellipse(p.x+jitter,p.y-jitter,r*.55,r*.35,angle,0,Math.PI*2);ctx.fill()}
 }
 // The leading head is a short irregular cluster on the same curve.
 for(let j=0;j<5;j++){const p=point(Math.max(tail,head-j*.005));const r=2.2-j*.22;ctx.globalAlpha=fade*(1-j*.13);ctx.drawImage(sprite,p.x-r*2,p.y-r*2,r*4,r*4)}
 ctx.restore()
}
