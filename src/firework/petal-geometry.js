// Independent source-contour candidates. Same root positions, length and five angles.
export const petalSpecs={A:{width:.21,shoulder:.57,name:'A / slender'},B:{width:.28,shoulder:.6,name:'B / outward sweep'},C:{width:.34,shoulder:.57,name:'C / fuller'}}
export function petalSegments(type='B'){
 const {width:w,shoulder:m}=petalSpecs[type]??petalSpecs.B
 // Local y is outward. Narrow shared root at y=0.46; tip remains y=1.
 return [
 [[-.075,.46],[-w*.45,.57],[-w,.78],[-w*.6,.88]],
 [[-w*.6,.88],[-w*.28,.96],[-.03,1],[0,1]],
 [[0,1],[.03,1],[w*.28,.96],[w*.6,.88]],
 [[w*.6,.88],[w,.78],[w*.45,.57],[.075,.46]],
 [[.075,.46],[.04,.44],[-.04,.44],[-.075,.46]]
 ]
}
export function samplePetal(type='B'){const out=[];for(const [a,b,c,d]of petalSegments(type))for(let i=0;i<32;i++){const t=i/32,u=1-t;out.push({x:u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],y:u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]})}return out}
export function paintPetal(ctx,type,x,y,length=160){ctx.save();ctx.translate(x,y);ctx.beginPath();for(const [i,[a,b,c,d]]of petalSegments(type).entries()){if(i===0)ctx.moveTo(a[0]*length,-(a[1]-.44)*length);ctx.bezierCurveTo(b[0]*length,-(b[1]-.44)*length,c[0]*length,-(c[1]-.44)*length,d[0]*length,-(d[1]-.44)*length)}ctx.closePath();ctx.fillStyle='#f3dcea';ctx.fill();ctx.restore()}
export function paintPetalFlower(ctx,type,x,y,size=80,{stamens=true}={}){ctx.save();ctx.translate(x,y);ctx.fillStyle='#f3dcea';ctx.beginPath();ctx.arc(0,0,size*.46,0,Math.PI*2);ctx.fill();for(let i=0;i<5;i++){ctx.save();ctx.rotate(i*Math.PI*2/5);paintPetal(ctx,type,0,-size*.44,size);ctx.restore()}
 // Same three-segment centre as clean-flower, no size or placement changes.
 ctx.strokeStyle='rgba(172,124,171,.72)';ctx.lineWidth=Math.max(.7,size*.024);ctx.lineCap='round';if(stamens)for(const [a,b]of [[{x:0,y:.1},{x:-.13,y:-.12}],[{x:0,y:.1},{x:.13,y:-.12}],[{x:0,y:.1},{x:0,y:.23}]]){ctx.beginPath();ctx.moveTo(a.x*size,a.y*size);ctx.lineTo(b.x*size,b.y*size);ctx.stroke()}ctx.restore()}
