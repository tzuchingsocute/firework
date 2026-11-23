// Independent static composition. Reuses the established three cached particle sprites.
import {paintParticleBrush} from '../../src/firework/particle-brush.js'
const palettes=[['#f7d995','#ddb3ee','#a9e5ef'],['#a9d9f5','#d4b8ee','#f1cfb1'],['#ead19c','#b9e4c9','#d4b8ef'],['#edbed6','#bbd1f6','#d9e4b1']]
function random(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
export function createDensePeak(seed=1201,budget=3600,{paletteIndex=0}={}){
 const r=random(seed),colors=palettes[paletteIndex%palettes.length],strokes=[],particles=[],batches=colors.map(color=>({color,particles:[]})),rotation=r()*6.28
 // Coverage sectors contain unequal counts and jittered directions; unequal lengths
 // and clustered strands keep this from becoming an equally spaced radial icon.
 for(let i=0;i<48;i++){
  const kind=i%8===0?'long':i%3===0?'fine':i%3===1?'medium':'short'
  const angle=rotation+i/48*Math.PI*2+(r()-.5)*.14,length=kind==='long'?270+r()*65:kind==='medium'?150+r()*110:kind==='fine'?65+r()*145:45+r()*115
  const width=kind==='fine'?.5+r()*.6:kind==='long'?3+r()*3:1+r()*3,curvature=(r()-.5)*.22,color=Math.floor(r()*3),brightness=.45+r()*.5,density=.65+r()*.7
  strokes.push({kind,angle,length,width,curvature,color,brightness,density,origin:{x:(r()-.5)*10,y:(r()-.5)*10},gap:kind==='short'&&r()<.5})
 }
 const weights=strokes.map(s=>s.length*s.density),total=weights.reduce((a,b)=>a+b,0),counts=weights.map(w=>Math.floor(w/total*(budget-80)))
 for(let i=0;counts.reduce((a,b)=>a+b,0)<budget-80;i++)counts[i%48]++
 for(let k=0;k<48;k++){
  const s=strokes[k];for(let j=0;j<counts[k];j++){
   let t=r();if(s.gap&&t>.42&&t<.56)t=.56+(t-.42)*.5
   const width=s.width*(.2+Math.pow(t,1.8)),side=(r()-.5)*width*2,rad=t*s.length,angle=s.angle+s.curvature*t
   const p={type:'stream',birth:0,life:2,vx:0,vy:0,x:s.origin.x+Math.cos(angle)*rad-Math.sin(angle)*side,y:s.origin.y+Math.sin(angle)*rad+Math.cos(angle)*side-2,size:(.55+r()*.65)*(s.kind==='fine'?.65:1)*( .55+t*.8),stretch:1+r()*.6,angle:angle+(r()-.5)*.8,brightness:s.brightness,shape:j%3,strokeId:k}
   particles.push(p);batches[s.color].particles.push(p)
  }
 }
 for(let i=0;i<80;i++){const a=r()*6.28,rad=Math.pow(r(),1.7)*24,p={type:'cluster',birth:0,life:2,vx:0,vy:0,x:Math.cos(a)*rad,y:Math.sin(a)*rad-2,size:.4+r()*.6,stretch:1+r(),angle:a,brightness:.8,shape:i%3};particles.push(p);batches[i%3].particles.push(p)}
 return {seed,budget:particles.length,strokes,batches,particles}
}
export function paintDensePeak(ctx,peak){
 ctx.save();ctx.globalCompositeOperation='lighter'
 for(const b of peak.batches)paintParticleBrush(ctx,b,500,{color:b.color})
 // Small sharp highlights embedded in the dense core, no independent giant star.
 const g=ctx.createRadialGradient(0,0,0,0,0,28);g.addColorStop(0,'rgba(245,246,255,.7)');g.addColorStop(.3,'rgba(209,190,245,.22)');g.addColorStop(1,'rgba(180,190,245,0)');ctx.fillStyle=g;ctx.fillRect(-28,-28,56,56)
 for(const [a,l]of [[.1,28],[1.7,35],[2.85,22],[4.3,30]]){ctx.save();ctx.rotate(a);ctx.fillStyle='rgba(248,252,255,.8)';ctx.beginPath();ctx.moveTo(-5,0);ctx.quadraticCurveTo(4,-2,l,0);ctx.quadraticCurveTo(4,2,-5,0);ctx.fill();ctx.restore()}
 ctx.restore()
}
