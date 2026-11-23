import {paintTexturedTrail} from './trail-material.js'
import {createComposition} from './composition.js'
export const duration=1440
const clamp=x=>Math.max(0,Math.min(1,x))
function phase(age,config){return config ? (age-config.start)/(config.end-config.start) : -1}
function envelope(t){return t<0||t>=1?0:clamp(t/.12)*clamp((1-t)/.3)}
function star(ctx,x,y,r,color,five=false){
 ctx.save();ctx.translate(x,y);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=3
 ctx.beginPath()
 if(five){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.43:r;ctx.lineTo(Math.cos(a)*s,Math.sin(a)*s)}}
 else{ctx.moveTo(0,-r);for(let i=0;i<4;i++){ctx.save();const a=i*Math.PI/2;const ex=Math.sin(a+Math.PI/2)*r,ey=-Math.cos(a+Math.PI/2)*r;const mx=Math.sin(a+Math.PI/4)*r*.16,my=-Math.cos(a+Math.PI/4)*r*.16;ctx.bezierCurveTo(mx,my,mx,my,ex,ey);ctx.restore()}}
 ctx.closePath();ctx.fill();ctx.restore()
}
function noise(i,k){return (Math.imul(i+1,k)>>>0)/4294967296}
export function paintCenter(ctx,t,color,count=8,seed=0){
 const fade=envelope(t);if(!fade)return
 ctx.save();ctx.globalAlpha*=fade
 for(let i=0;i<count;i++){
  const n=noise(i+seed,0x27d4eb2d),angle=i/count*Math.PI*2+(n-.5)*.14
  const radius=(i%2===0?27:16)*(1+n*.32)*(.55+.45*clamp(t/.35))
  ctx.save();ctx.rotate(angle);ctx.fillStyle='#edf3ff';ctx.shadowColor=color;ctx.shadowBlur=5
  ctx.beginPath();ctx.moveTo(-1.4,0);ctx.quadraticCurveTo(0,-5,0,-radius);ctx.quadraticCurveTo(.8,-5,1.4,0);ctx.fill();ctx.restore()
 }
 ctx.fillStyle='#f8fbff';ctx.shadowBlur=7;ctx.shadowColor=color;ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.restore()
}
export function paintMainBurst(ctx,t,color,brightness=1,secondary=false,options={}){
 if(t<0||t>=1)return
 ctx.save();ctx.globalAlpha*=brightness
 const count=options.basic?12:secondary?12:18
 for(let i=0;i<count;i++){
  const n=noise(i,0x85ebca6b),speed=noise(i,0x27d4eb2d)
  paintTexturedTrail(ctx,(t-.06-speed*.11)/(.77+speed*.08),{angle:i/count*Math.PI*2+(n-.5)*.32,length:(secondary?85:158)*(.48+n*.52),bend:(speed-.5)*44,color,seed:i,weight:.6+n*.4})
 }
 if(!options.basic){
  // A few shorter internal trails, deliberately leaving empty sectors.
  for(let i=0;i<5;i++)paintTexturedTrail(ctx,(t-.22-i*.015)/.7,{angle:i*1.31+.4,length:50+i*8,bend:8,color,seed:i+40,weight:.42})
  paintCenter(ctx,t,color,options.rays??8,options.seed??0)
 }
 ctx.restore()
}
export function paintSparkles(ctx,t,color){
 const fade=envelope(t);if(!fade)return
 const positions=[[69,-113,6],[142,-53,7],[150,64,9],[-130,90,6],[-24,119,5]]
 positions.forEach(([x,y,r],i)=>{const local=envelope(t-i*.035);if(!local)return;ctx.save();ctx.globalAlpha*=local;star(ctx,x,y,r*(.7+.3*Math.sin(Math.PI*clamp(t))),color,i!==1);ctx.restore()})
}
export function paintComposition(ctx,age,composition){
 for(const firework of composition.fireworks){
  ctx.save();ctx.translate(firework.x,firework.y);ctx.scale(firework.size,firework.size)
  paintMainBurst(ctx,phase(age,firework.main),firework.color,firework.brightness)
  const secondary=firework.secondary
  if(secondary){ctx.save();ctx.translate(secondary.x,secondary.y);ctx.scale(secondary.size,secondary.size);paintMainBurst(ctx,phase(age,secondary),secondary.color??firework.color,.6,true);ctx.restore()}
  paintSparkles(ctx,phase(age,firework.sparkles),composition.colors[2]);ctx.restore()
 }
 if(composition.sparkles)paintSparkles(ctx,phase(age,composition.sparkles),composition.sparkles.color)
}
export function paintFirework(ctx,age,position,bounds,composition=createComposition(0)){
 const scale=Math.min(bounds.width/412,bounds.height/414)*.92
 const x=Math.max(bounds.x+206*scale,Math.min(bounds.x+bounds.width-206*scale,position.x)),y=Math.max(bounds.y+207*scale,Math.min(bounds.y+bounds.height-207*scale,position.y))
 ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.width,bounds.height);ctx.clip();ctx.translate(x,y);ctx.scale(scale,scale);paintComposition(ctx,age,composition);ctx.restore()
}
