// Independent butterfly study: two shared wing surfaces per side, hinged at body.
const rad=d=>d*Math.PI/180
const contours=[[[0,-.08],[.22,-.76],[.96,-1],[.9,-.24],[.79,.02],[.34,.15],[0,.06]],[[0,.05],[.34,.06],[.88,.14],[.61,.68],[.27,.86],[.1,.35],[0,.1]]]
function curve(points){const out=[];for(let i=0;i<points.length;i++){const a=points[(i-1+points.length)%points.length],b=points[i],c=points[(i+1)%points.length],d=points[(i+2)%points.length];for(let j=0;j<12;j++){const t=j/12,t2=t*t,t3=t2*t;out.push([.5*((2*b[0])+(-a[0]+c[0])*t+(2*a[0]-5*b[0]+4*c[0]-d[0])*t2+(-a[0]+3*b[0]-3*c[0]+d[0])*t3),.5*((2*b[1])+(-a[1]+c[1])*t+(2*a[1]-5*b[1]+4*c[1]-d[1])*t2+(-a[1]+3*b[1]-3*c[1]+d[1])*t3)])}}return out}
// Authored cubic surfaces overlap at the root; the upper wing overlays the lower.
// Each segment is [start, control1, control2, end] in the shared body plane.
export const wingCurves=[
 [ [[-.012,.1],[.12,-.28],[.55,-.98],[1.05,-.91]], [[1.05,-.91],[1.24,-.86],[.79,-.13],[.54,.05]], [[.54,.05],[.3,.2],[.08,.2],[-.012,.1]] ],
 [ [[-.012,-.015],[.2,-.03],[.54,.04],[.64,.22]], [[.64,.22],[.73,.39],[.57,.59],[.34,.61]], [[.34,.61],[.15,.55],[.025,.28],[-.012,-.015]] ]
]
function sampleCubics(segments){const out=[];for(const [a,b,c,d]of segments)for(let i=0;i<32;i++){const t=i/32,u=1-t;out.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]])}return out}
const wings=wingCurves.map(sampleCubics)

export function butterflyGeometry({yaw=0,pitch=0,roll=0,openness=1},size=50){const fold=(1-Math.max(0,Math.min(1,openness)))*1.35,Y=rad(yaw),P=rad(pitch),R=rad(roll),surfaces=[]
 for(const side of [-1,1])for(let wing=0;wing<2;wing++){
  const points=wings[wing].map(([u,v])=>{let x=side*u*size*Math.cos(fold),y=v*size,z=u*size*Math.sin(fold);let nx=x*Math.cos(Y)+z*Math.sin(Y),nz=-x*Math.sin(Y)+z*Math.cos(Y);x=nx;z=nz;const ny=y*Math.cos(P)-z*Math.sin(P);nz=y*Math.sin(P)+z*Math.cos(P);y=ny;z=nz;nx=x*Math.cos(R)-y*Math.sin(R);const ry=x*Math.sin(R)+y*Math.cos(R),f=240/(240-z);return {x:nx*f,y:ry*f,z}})
  surfaces.push({side,wing,points,depth:points.reduce((n,p)=>n+p.z,0)/points.length})
 }return surfaces.sort((a,b)=>Math.abs(a.depth-b.depth)<size*.05?b.wing-a.wing:a.depth-b.depth)
}
export function paintButterfly(ctx,v,x,y,size=50,glow=1){ctx.save();ctx.translate(x,y);const surfaces=butterflyGeometry(v,size)
 // Single coverage fill of the projected surfaces avoids alpha accumulation at
 // intersections. Independent wing geometry and the original hinge remain intact.
 ctx.beginPath()
 for(const s of surfaces){
  const area=s.points.reduce((n,p,i)=>{const q=s.points[(i+1)%s.points.length];return n+p.x*q.y-q.x*p.y},0)
  const points=area<0?[...s.points].reverse():s.points
  points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath()
 }
 ctx.shadowColor='#edc3ff';ctx.shadowBlur=glow*8
 // Original fore/hind colours interpolate over the shared coverage rather than
 // painting a second translucent layer across the root.
 const fill=ctx.createLinearGradient(0,-size*.25,0,size*.45)
 fill.addColorStop(0,'rgba(255,241,255,.94)');fill.addColorStop(1,'rgba(249,220,249,.82)')
 ctx.fillStyle=fill;ctx.fill('nonzero');ctx.shadowBlur=0
 ctx.globalAlpha=.35;ctx.fillStyle='#fff7ff'
 for(const s of surfaces)for(let i=3;i<s.points.length;i+=13){const p=s.points[i];ctx.fillRect(p.x,p.y,.65,.9)}ctx.globalAlpha=1

 ctx.restore()}
export function seededButterflies(seed=6062,count=12){let n=seed;const r=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);return Array.from({length:count},(_,i)=>({name:`${i+1}`,yaw:Math.round((r()-.5)*90),pitch:Math.round((r()-.5)*60),roll:Math.round((r()-.5)*90),openness:+(.18+r()*.82).toFixed(2)}))}
export const opennessViews=[1,.75,.5,.25,.12].map(openness=>({name:`Open ${Math.round(openness*100)}%`,yaw:0,pitch:0,roll:0,openness}))
export const perspectiveViews=[{yaw:0,pitch:0,roll:0},{yaw:-40,pitch:0,roll:0},{yaw:40,pitch:0,roll:0},{yaw:0,pitch:-35,roll:0},{yaw:0,pitch:35,roll:0},{yaw:32,pitch:-25,roll:30}].map((v,i)=>({...v,openness:.7,name:`View ${i+1}`}))
export function paintButterflyMatrix(canvas,views,columns=4,{material=false}={}){canvas.width=columns*250;canvas.height=Math.ceil(views.length/columns)*240;const ctx=canvas.getContext('2d');ctx.fillStyle='#101522';ctx.fillRect(0,0,canvas.width,canvas.height);views.forEach((v,i)=>{const x=i%columns*250+125,y=Math.floor(i/columns)*240+100;paintButterfly(ctx,v,x,y,48,v.glow??1);ctx.fillStyle='#dce3f3';ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText(v.name??`${i+1}`,x,y+84);ctx.fillStyle='#aab3ca';ctx.font='11px monospace';ctx.fillText(`Y ${v.yaw} P ${v.pitch} R ${v.roll} / Open ${v.openness}`,x,y+107)})}
