import {starContour} from './star-perspective.js'
import {elongatedContour} from './elongated-star.js'
const TAU=Math.PI*2
const circularDistance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))
export function secondaryStarGeometry({secondaryRayCount=0,secondaryRayAngles=null,secondaryRayLength=.32,secondaryRayWidth=.08,seed=6019,elongation=null,pairAngleVariation=.07,pairLengthVariation=true}={}){
 if(![0,2,4,6].includes(secondaryRayCount))throw new Error('secondaryRayCount must be 0, 2, 4 or 6')
 if(secondaryRayCount===0)return {points:elongation?elongatedContour(elongation):starContour(),secondaryAngles:[]}
 let n=seed>>>0;const r=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296),primary=[0,Math.PI/2,Math.PI,Math.PI*1.5],angles=[]
 const valid=a=>primary.every(b=>circularDistance(a,b)>.3)&&angles.every(b=>circularDistance(a,b)>.34)
 if(secondaryRayAngles){if(secondaryRayAngles.length!==secondaryRayCount)throw new Error('Angle count mismatch');for(const degrees of secondaryRayAngles){const a=((degrees*Math.PI/180)%TAU+TAU)%TAU;if(!valid(a))throw new Error('Rays violate angular clearance');angles.push(a)}}
 else {
  let complete=false
  for(let restart=0;restart<100&&!complete;restart++){
   angles.length=0
   for(let pair=0;pair<secondaryRayCount/2;pair++){
    let found=false
    for(let k=0;k<500;k++){
     const a=r()*TAU,b=(a+Math.PI+(r()-.5)*2*pairAngleVariation)%TAU
     if(valid(a)&&valid(b)&&circularDistance(a,b)>.34){angles.push(a,b);found=true;break}
    }
    if(!found)break
   }
   complete=angles.length===secondaryRayCount
  }
  if(!complete)throw new Error('No paired angular capacity')
 }
 if(secondaryRayAngles)for(let i=0;i<angles.length;i+=2)if(Math.abs(circularDistance(angles[i],angles[i+1])-Math.PI)>.16)throw new Error('Explicit angles must be opposite ordered pairs')
 const pairLengths=Array.from({length:secondaryRayCount/2},()=>secondaryRayLength*(.83+r()*.3))

 const rays=primary.map((angle,i)=>({angle,length:i%2===0?.76:1,primary:true})).concat(angles.map((angle,i)=>({angle,length:Math.max(.15,Math.min(.45,Array.isArray(secondaryRayLength)?secondaryRayLength[i]:(pairLengthVariation?secondaryRayLength*(.83+r()*.3):pairLengths[Math.floor(i/2)]))),primary:false}))).sort((a,b)=>a.angle-b.angle)
 const points=[]
 for(let i=0;i<rays.length;i++){const a=rays[i],b=rays[(i+1)%rays.length],start={x:Math.cos(a.angle)*a.length,y:Math.sin(a.angle)*a.length},end={x:Math.cos(b.angle)*b.length,y:Math.sin(b.angle)*b.length},wa=a.primary?.12:secondaryRayWidth,wb=b.primary?.12:secondaryRayWidth,c={x:start.x*wa,y:start.y*wa},d={x:end.x*wb,y:end.y*wb}
  for(let k=0;k<48;k++){const t=k/48,u=1-t;points.push({x:u*u*u*start.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*end.x,y:u*u*u*start.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*end.y})}
 }
 if(elongation){const e=elongation.elongation??1.7;for(const p of points){if(elongation.axis==='horizontal'){p.x*=e;p.y/=Math.sqrt(e)}else{p.y*=e;p.x/=Math.sqrt(e)}}}
 return {points,secondaryAngles:angles.map(a=>a*180/Math.PI),pairs:Array.from({length:angles.length/2},(_,i)=>angles.slice(i*2,i*2+2).map(a=>a*180/Math.PI)),rays}
}
export function paintSecondaryStar(ctx,config,x,y,size=65){const {points}=secondaryStarGeometry(config);ctx.save();ctx.translate(x,y);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x*size,p.y*size):ctx.moveTo(p.x*size,p.y*size));ctx.closePath();ctx.fillStyle='#f6f0ff';ctx.fill();ctx.restore()}
export function secondaryMatrix(canvas,configs,columns=4){canvas.width=columns*260;canvas.height=Math.ceil(configs.length/columns)*235;const ctx=canvas.getContext('2d');ctx.fillStyle='#101522';ctx.fillRect(0,0,canvas.width,canvas.height);configs.forEach((v,i)=>{const x=i%columns*260+130,y=Math.floor(i/columns)*235+100;paintSecondaryStar(ctx,v,x,y);ctx.textAlign='center';ctx.fillStyle='#dbe3f4';ctx.font='14px sans-serif';ctx.fillText(v.name??`${v.secondaryRayCount} secondary rays`,x,y+88)})}
