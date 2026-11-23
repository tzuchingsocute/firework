// Independent replacement candidate: full oval-arc petals with a short broad base.
export function createBlossomPetal({width=.43,length=1,lean=.025}={}){
 return [
 [[-.13,0],[-.22,.08],[-width,.25],[-width,.54]],
 [[-width,.54],[-width,.83],[-.22+lean,length],[lean,length]],
 [[lean,length],[.24+lean,length],[width,.84],[width,.55]],
 [[width,.55],[width,.28],[.23,.09],[.13,0]],
 [[.13,0],[.075,-.035],[-.075,-.035],[-.13,0]]
 ]
}
export const blossomLayouts={
 A:{angles:[0,72,144,216,288],lengths:[1,1,1,1,1],widths:[.43,.43,.43,.43,.43],roots:[0,0,0,0,0]},
 B:{angles:[-5,69,145,214,289],lengths:[1.03,.97,1.02,.95,1],widths:[.42,.46,.42,.45,.43],roots:[0,.01,-.005,.008,0]},
 C:{angles:[-3,70,147,216,289],lengths:[1.06,1,1.04,.99,1.02],widths:[.37,.39,.37,.4,.38],roots:[.015,.015,.015,.015,.015]}
}
function sample(segments){const points=[];for(const [a,b,c,d]of segments)for(let k=0;k<32;k++){const t=k/32,u=1-t;points.push({x:u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],y:-(u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1])})}return points}
export function createBlossomGeometry(type='B'){const l=blossomLayouts[type],petals=l.angles.map((angle,i)=>{const a=angle*Math.PI/180,points=sample(createBlossomPetal({width:l.widths[i],length:l.lengths[i],lean:type==='B'?(i-2)*.012:.015})).map(p=>({x:p.x*Math.cos(a)-p.y*Math.sin(a)+Math.sin(a)*l.roots[i],y:p.x*Math.sin(a)+p.y*Math.cos(a)-Math.cos(a)*l.roots[i]}));return {angle,points}}),all=petals.flatMap(p=>p.points),width=Math.max(...all.map(p=>p.x))-Math.min(...all.map(p=>p.x)),height=Math.max(...all.map(p=>p.y))-Math.min(...all.map(p=>p.y));return {petals,width,height,centerRadius:width*.03}}
export function paintBlossom(ctx,type,x,y,size=100,{glow=false,color='#f3dcea'}={}){const g=createBlossomGeometry(type),scale=2*size/Math.max(g.width,g.height);ctx.save();ctx.translate(x,y);ctx.beginPath();for(const {points}of g.petals){points.forEach((p,i)=>i?ctx.lineTo(p.x*scale,p.y*scale):ctx.moveTo(p.x*scale,p.y*scale));ctx.closePath()}ctx.fillStyle=color;if(glow){ctx.shadowColor='#dfb9f1';ctx.shadowBlur=7}ctx.fill('nonzero');ctx.shadowBlur=0;ctx.beginPath();ctx.arc(0,0,g.centerRadius*scale,0,Math.PI*2);ctx.fill();ctx.restore()}
export function paintBlossomPetal(ctx,x,y,size=180,color='#f3dcea'){const s=createBlossomPetal();ctx.save();ctx.translate(x,y);ctx.beginPath();for(const [i,[a,b,c,d]]of s.entries()){if(!i)ctx.moveTo(a[0]*size,-a[1]*size);ctx.bezierCurveTo(b[0]*size,-b[1]*size,c[0]*size,-c[1]*size,d[0]*size,-d[1]*size)}ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore()}
