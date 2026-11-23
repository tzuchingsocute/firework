import {petalSegments} from './petal-geometry.js'
import {arrangements} from './petal-arrangement.js'
export function narrowedPetal(level='B'){const factor={A:.55,B:.28,C:.14}[level],s=structuredClone(petalSegments('B'))
 // Only root anchors, cap and adjacent inner controls change. Outer segments intact.
 for(const index of [0,3]){const segment=s[index];if(index===0){segment[0][0]*=factor;segment[1][0]*=factor}else{segment[2][0]*=factor;segment[3][0]*=factor}}
 s[4]=s[4].map(([x,y])=>[x*factor,y]);return s
}
export function negativeSpaceFlower(ctx,{x=0,y=0,size=100,root='B',centerRatio=.06,spacing='medium',glow=false,rootSegments=null}={}){
 const config=arrangements.B,segments=rootSegments??narrowedPetal(root),offsets={small:[0,0,0,0,0],medium:[0,-1,1,-.5,.5],large:[-2,1,2,-1,0]}[spacing],extent=[]
 for(let i=0;i<5;i++){const a=config.angles[i]*Math.PI/180,o=(config.angles[i]+config.offsets[i]+offsets[i])*Math.PI/180;for(const [p,b,c,d]of (typeof rootSegments==='function'?rootSegments(i):segments))for(let k=0;k<32;k++){const t=k/32,u=1-t,x=u*u*u*p[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],y=-(u*u*u*p[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]-.44);extent.push({x:Math.sin(a)*config.roots[i]+x*Math.cos(o)-y*Math.sin(o),y:-Math.cos(a)*config.roots[i]+x*Math.sin(o)+y*Math.cos(o)})}}
 const w=Math.max(...extent.map(p=>p.x))-Math.min(...extent.map(p=>p.x)),h=Math.max(...extent.map(p=>p.y))-Math.min(...extent.map(p=>p.y)),scale=size*2/Math.max(w,h)
 const width=w*scale,centerRadius=centerRatio*width/2
 ctx.save();ctx.translate(x,y);if(glow){ctx.shadowColor='#dfb9f1';ctx.shadowBlur=7}ctx.fillStyle='#f3dcea'
 for(let i=0;i<5;i++){ctx.save();const a=config.angles[i]*Math.PI/180,r=config.roots[i]*scale;ctx.translate(Math.sin(a)*r,-Math.cos(a)*r);ctx.rotate((config.angles[i]+config.offsets[i]+offsets[i])*Math.PI/180);ctx.beginPath();for(const [j,[a,b,c,d]]of (typeof rootSegments==='function'?rootSegments(i):segments).entries()){if(j===0)ctx.moveTo(a[0]*scale,-(a[1]-.44)*scale);ctx.bezierCurveTo(b[0]*scale,-(b[1]-.44)*scale,c[0]*scale,-(c[1]-.44)*scale,d[0]*scale,-(d[1]-.44)*scale)}ctx.closePath();ctx.fill();ctx.restore()}
 ctx.beginPath();ctx.arc(0,0,centerRadius,0,Math.PI*2);ctx.fill();ctx.restore();return {centerRadius,estimatedWidth:width}
}
