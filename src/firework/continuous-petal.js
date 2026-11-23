import {negativeSpaceFlower} from './flower-negative-space.js'
export const continuousPetalPresets={A:{petalMaxWidth:.56,widestPointPosition:.63,sideCurvature:.7,tipRoundness:.8},B:{petalMaxWidth:.5,widestPointPosition:.67,sideCurvature:.85,tipRoundness:.58,asymmetry:.035},C:{petalMaxWidth:.39,widestPointPosition:.6,sideCurvature:.8,tipRoundness:.68}}
export function createPetalContour({petalLength=1,petalMaxWidth=.5,widestPointPosition=.65,sideCurvature=.8,tipRoundness=.65,rootWidth=.04,asymmetry=0}={}){
 const w=petalMaxWidth/2,r=rootWidth/2,m=widestPointPosition,L=petalLength,right=w*(1+asymmetry),left=w*(1-asymmetry),root=[-r,0],a=[-left,m*L],tip=[asymmetry*.1,L],b=[right,m*L],end=[r,0],handle=(1-m)*L*.6
 // Anchors lie at the root, lateral extrema and crown. Tangents are shared
 // across segments: vertical at widest points, horizontal across the crown.
 return [
 [root,[-r,.2*L],[-left,m*L-.23*L*sideCurvature],a],
 [a,[-left,m*L+handle],[tip[0]-w*tipRoundness,L],tip],
 [tip,[tip[0]+w*tipRoundness,L],[right,m*L+handle],b],
 [b,[right,m*L-.23*L*sideCurvature],[r,.2*L],end],
 [end,[r,-.025*L],[-r,-.025*L],root]
 ]
}
export function mappedPetal(type='B'){return createPetalContour(continuousPetalPresets[type]).map(segment=>segment.map(([x,y])=>[x,.46+y*.54]))}
export function paintContinuousFlower(ctx,type,options={}){return negativeSpaceFlower(ctx,{...options,rootSegments:mappedPetal(type)})}
export function paintContinuousPetal(ctx,type,x,y,size=190,{color='#f3dcea',controls=false}={}){const segments=createPetalContour(continuousPetalPresets[type]);ctx.save();ctx.translate(x,y);ctx.beginPath();for(const [i,[a,b,c,d]]of segments.entries()){if(!i)ctx.moveTo(a[0]*size,-a[1]*size);ctx.bezierCurveTo(b[0]*size,-b[1]*size,c[0]*size,-c[1]*size,d[0]*size,-d[1]*size)}ctx.closePath();ctx.fillStyle=color;ctx.fill();if(controls){ctx.lineWidth=1;for(const [a,b,c,d]of segments){ctx.strokeStyle='#6bb9ce';ctx.beginPath();ctx.moveTo(a[0]*size,-a[1]*size);ctx.lineTo(b[0]*size,-b[1]*size);ctx.moveTo(c[0]*size,-c[1]*size);ctx.lineTo(d[0]*size,-d[1]*size);ctx.stroke();for(const p of [a,b,c,d]){ctx.fillStyle='#ffc887';ctx.beginPath();ctx.arc(p[0]*size,-p[1]*size,2.5,0,Math.PI*2);ctx.fill()}}}ctx.restore()}
