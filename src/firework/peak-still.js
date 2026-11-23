// Standalone authored peak composition, in 800 × 800 local coordinates.
// No dependency from the formal controller; paths remain independently addressable.
export const peakPaths = [
 [-175,-305,-100,-260,'gold',7], [38,-292,10,-140,'pink',7],
 [247,-220,110,-195,'gold',8], [294,-75,150,-120,'pink',7],
 [350,53,190,-3,'gold',8], [240,210,215,95,'pink',9],
 [118,300,125,170,'gold',9], [-148,282,-72,140,'pink',9],
 [-205,142,-142,100,'gold',8], [-327,85,-235,-28,'gold',9],
 [-295,-145,-180,-180,'pink',8], [-212,-67,-150,-65,'gold',6],
 [80,-176,65,-140,'gold',6], [165,55,120,30,'gold',6],
 [34,192,25,125,'gold',6]
].map(([x,y,cx,cy,color,width],id)=>({id,end:{x,y},control:{x:cx,y:cy},color,width}))
const palette={gold:[255,220,130],pink:[245,177,255],cyan:[135,234,255]}
function rng(){let n=1201;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
const rgba=(c,a)=>`rgba(${c.join(',')},${a})`
function point(p,t){return {x:2*(1-t)*t*p.control.x+t*t*p.end.x,y:2*(1-t)*t*p.control.y+t*t*p.end.y}}
function glow(ctx,x,y,r,c,a){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(c,a));g.addColorStop(.3,rgba(c,a*.32));g.addColorStop(1,rgba(c,0));ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
export function paintPeakStill(ctx){
 const random=rng();ctx.save();ctx.globalCompositeOperation='lighter'
 // Localized color light follows the authored paths, never a rectangular overlay.
 for(const p of peakPaths){const c=palette[p.color];for(let j=3;j<12;j++){const t=j/12,q=point(p,t);glow(ctx,q.x,q.y,16+t*17,c,.055+t*.065)}}
 for(const p of peakPaths){const c=palette[p.color]
  for(let j=0;j<650;j++){
   const t=.13+.87*(j+random())/650,q=point(p,t),tangent={x:2*(1-t)*p.control.x+2*t*(p.end.x-p.control.x),y:2*(1-t)*p.control.y+2*t*(p.end.y-p.control.y)},len=Math.hypot(tangent.x,tangent.y),width=(.25+Math.pow(t,3)*p.width*1.25),offset=(random()-.5)*width
   const x=q.x-tangent.y/len*offset,y=q.y+tangent.x/len*offset,size=(.28+random()*.95)*(.3+Math.pow(t,3)*2.5),alpha=.18+t*.55
   if(j%10===0)glow(ctx,x,y,size*5,c,.14)
   ctx.fillStyle=rgba(j%4===0?[255,253,245]:c,alpha);ctx.beginPath();ctx.moveTo(x-size,y);ctx.lineTo(x-.2*size,y-1.3*size);ctx.lineTo(x+.7*size,y-.5*size);ctx.lineTo(x+size,y+.6*size);ctx.lineTo(x-.4*size,y+size);ctx.closePath();ctx.fill()
  }
  for(let k=0;k<85;k++){const t=.89+random()*.11,q=point(p,t),x=q.x+(random()-.5)*p.width,y=q.y+(random()-.5)*p.width*.7;ctx.fillStyle=rgba([255,251,240],.65+random()*.3);ctx.beginPath();ctx.ellipse(x,y,.6+random()*1.8,.5+random()*1.6,random()*3,0,Math.PI*2);ctx.fill()}
  const q=point(p,.985);glow(ctx,q.x,q.y,15,c,.23)
 }
 // Fixed unequal luminous rays: tapered concave shapes, not a polygon sticker.
 glow(ctx,0,0,67,palette.pink,.45);glow(ctx,0,0,32,palette.cyan,.6)
 const rays=[[-1.48,137,10],[-.55,126,8],[.08,76,9],[.74,92,8],[1.77,150,10],[2.8,173,8],[3.9,163,9],[4.5,92,7]]
 for(const [a,l,w]of rays){ctx.save();ctx.rotate(a);const g=ctx.createLinearGradient(0,0,l,0);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.22,'rgba(241,248,255,.95)');g.addColorStop(1,'rgba(155,220,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-8,0);ctx.quadraticCurveTo(12,-w,l,0);ctx.quadraticCurveTo(12,w,-8,0);ctx.fill();ctx.restore()}
 glow(ctx,0,0,23,[255,255,255],1)
 const accents=[[-245,211,8,'pink'],[248,120,11,'pink'],[-201,-175,3,'gold'],[140,-201,4,'cyan'],[-250,130,4,'cyan'],[-26,224,5,'gold'],[155,210,4,'cyan']]
 for(const [x,y,size,color]of accents){glow(ctx,x,y,size*3,palette[color],.3);ctx.fillStyle='rgba(245,253,255,.95)';ctx.beginPath();ctx.moveTo(x,y-size);ctx.quadraticCurveTo(x+size*.12,y-size*.12,x+size,y);ctx.quadraticCurveTo(x+size*.12,y+size*.12,x,y+size);ctx.quadraticCurveTo(x-size*.12,y+size*.12,x-size,y);ctx.quadraticCurveTo(x-size*.12,y-size*.12,x,y-size);ctx.fill()}
 ctx.restore()
}
