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
export function paintMainBurst(ctx,t,color,brightness=1,secondary=false){
 const fade=envelope(t);if(!fade)return
 const progress=1-Math.pow(1-clamp((t-.08)/.75),2.1),count=secondary?19:27
 ctx.save();ctx.globalAlpha*=fade*brightness
 for(let i=0;i<count;i++){
  const n=((i*137.508)%360)/360,a=i/count*Math.PI*2+(n-.5)*.16
  const reach=(secondary?105:145)*(.55+n*.45)*progress
  const begin=reach*(.32+.3*((i*7)%11)/11),bend=(n-.5)*16*progress
  const ex=Math.cos(a)*reach,ey=Math.sin(a)*reach+10*progress*progress
  const sx=Math.cos(a)*begin,sy=Math.sin(a)*begin
  const gradient=ctx.createLinearGradient(sx,sy,ex,ey);gradient.addColorStop(0,'rgba(220,232,244,0)');gradient.addColorStop(.65,color);gradient.addColorStop(1,'#f6f6e8')
  ctx.strokeStyle=gradient;ctx.lineWidth=secondary?.75:1.05;ctx.shadowColor=color;ctx.shadowBlur=secondary?2:3
  ctx.beginPath();ctx.moveTo(sx,sy);ctx.quadraticCurveTo((sx+ex)/2+bend,(sy+ey)/2,ex,ey);ctx.stroke()
  ctx.fillStyle='#f0f5ee';ctx.beginPath();ctx.arc(ex,ey,i%5===0?1.7:.8,0,Math.PI*2);ctx.fill()
 }
 ctx.globalAlpha*=.85;star(ctx,0,0,(secondary?5:11)*(1-.35*clamp(t)),secondary?color:'#e5edff');ctx.restore()
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
