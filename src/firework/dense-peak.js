// Independent static composition. Reuses the established three cached particle sprites.
import {paintBrushTip} from './brush-tips.js'
import {paintParticleBrush} from './particle-brush.js'
const palettes=[['#f7d995','#ddb3ee','#a9e5ef'],['#a9d9f5','#d4b8ee','#f1cfb1'],['#ead19c','#b9e4c9','#d4b8ef'],['#edbed6','#bbd1f6','#d9e4b1']]
function random(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
export function createDensePeak(seed=1201,budget=3600,{paletteIndex=0}={}){
 const r=random(seed),colors=palettes[paletteIndex%palettes.length],strokes=[],particles=[],batches=colors.map(color=>({color,particles:[]})),rotation=r()*6.28,count=42+Math.floor(r()*13),aspect=.8+r()*.4
 // Coverage sectors contain unequal counts and jittered directions; unequal lengths
 // and clustered strands keep this from becoming an equally spaced radial icon.
 for(let i=0;i<count;i++){
  const kind=i%8===0?'long':i%3===0?'fine':i%3===1?'medium':'short'
  const angle=rotation+i/count*Math.PI*2+(r()-.5)*.14,length=kind==='long'?270+r()*65:kind==='medium'?150+r()*110:kind==='fine'?65+r()*145:45+r()*115
  const width=kind==='fine'?.5+r()*.6:kind==='long'?3+r()*3:1+r()*3,curvature=(r()-.5)*.22,color=Math.floor(r()*3),brightness=.45+r()*.5,density=.65+r()*.7
  const rank=r(),spec=rank<.35?'fine':rank<.8?'standard':'bold',scale=spec==='fine'?.48:spec==='bold'?2.3:1.1
  const pick=r(),tip=spec==='fine'?'natural':pick<.45?'natural':pick<.7?'star':pick<.85?'butterfly':pick<.95?'burst':'flower'
  strokes.push({spec,tip,tipSize:(spec==='bold'?14:8)+r()*9,tipRotation:(r()-.5)*1.5,hollow:r()<.2,projection:.72+r()*.28,scale,kind,angle,length,width:width*scale,curvature:curvature*(1+r()),color,brightness:spec==='bold'?.9:spec==='fine'?.4:brightness,density:density*(spec==='bold'?1.8:spec==='fine'?.6:1),origin:{x:(r()-.5)*10,y:(r()-.5)*10},gap:kind==='short'&&r()<.5})
 }
 const occupied=[]
 for(const s of strokes){if(s.tip==='natural')continue;const a=s.angle+s.curvature,p={x:Math.cos(a)*s.length,y:Math.sin(a)*s.length*aspect};if(s.length<95||occupied.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<s.tipSize+q.size+12)){s.tip='natural'}else occupied.push({...p,size:s.tipSize})}
 const weights=strokes.map(s=>s.length*s.density),total=weights.reduce((a,b)=>a+b,0),counts=weights.map(w=>Math.floor(w/total*(budget-80)))
 for(let i=0;counts.reduce((a,b)=>a+b,0)<budget-80;i++)counts[i%count]++
 for(let k=0;k<count;k++){
  const s=strokes[k];for(let j=0;j<counts[k];j++){
   let t=r();if(s.gap&&t>.42&&t<.56)t=.56+(t-.42)*.5
   const width=s.width*(.2+Math.pow(t,1.8)),side=(r()-.5)*width*2,rad=t*s.length,angle=s.angle+s.curvature*t
   const p={type:'stream',birth:0,life:2,vx:0,vy:0,x:s.origin.x+Math.cos(angle)*rad-Math.sin(angle)*side,y:s.origin.y+(Math.sin(angle)*rad+Math.cos(angle)*side)*aspect-2,size:(.55+r()*.65)*(s.spec==='fine'?.55:s.spec==='bold'?1.6:1)*( .55+t*.8),stretch:1+r()*.6,angle:angle+(r()-.5)*.8,brightness:s.brightness,shape:j%3,strokeId:k}
   particles.push(p);batches[s.color].particles.push(p)
  }
 }
 for(let i=0;i<80;i++){const a=r()*6.28,rad=Math.pow(r(),1.7)*24,p={type:'cluster',birth:0,life:2,vx:0,vy:0,x:Math.cos(a)*rad,y:Math.sin(a)*rad-2,size:.4+r()*.6,stretch:1+r(),angle:a,brightness:.8,shape:i%3};particles.push(p);batches[i%3].particles.push(p)}
 return {seed,budget:particles.length,strokes,batches,particles,aspect,colors}
}
export function paintDensePeak(ctx,peak,{tips=true}={}){
 ctx.save();ctx.globalCompositeOperation='lighter'
 for(const b of peak.batches)paintParticleBrush(ctx,b,500,{color:b.color})
 if(tips)for(const s of peak.strokes){const a=s.angle+s.curvature,x=s.origin.x+Math.cos(a)*s.length,y=(s.origin.y+Math.sin(a)*s.length)*peak.aspect;paintBrushTip(ctx,s.tip,x,y,s.tipSize,a+s.tipRotation,peak.colors[s.color],s)}
 // Small sharp highlights embedded in the dense core, no independent giant star.
 const g=ctx.createRadialGradient(0,0,0,0,0,28);g.addColorStop(0,'rgba(245,246,255,.7)');g.addColorStop(.3,'rgba(209,190,245,.22)');g.addColorStop(1,'rgba(180,190,245,0)');ctx.fillStyle=g;ctx.fillRect(-28,-28,56,56)
 for(const [a,l]of [[.1,28],[1.7,35],[2.85,22],[4.3,30]]){ctx.save();ctx.rotate(a);ctx.fillStyle='rgba(248,252,255,.8)';ctx.beginPath();ctx.moveTo(-5,0);ctx.quadraticCurveTo(4,-2,l,0);ctx.quadraticCurveTo(4,2,-5,0);ctx.fill();ctx.restore()}
 ctx.restore()
}
