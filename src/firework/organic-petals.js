import {negativeSpaceFlower,narrowedPetal} from './flower-negative-space.js'
// Local outward axis y: shared length .44–1, narrow root, four smooth outer cubics.
export function organicPetal(type='B',variation=0){
 const configs={A:{left:.24,right:.24,tip:.1,round:.95},B:{left:.22,right:.27,tip:.065,round:.98},C:{left:.29,right:.32,tip:.14,round:.93}},c=configs[type],v=Math.sin(variation)*.008
 return [
 [[-.021,.46],[-.048,.57],[-c.left*.62,.67],[-c.left,.76]],
 [[-c.left,.76],[-c.left,.91],[-c.tip,.995],[.015,1]],
 [[.015,1],[c.tip+v,1],[c.right,.91],[c.right,.78]],
 [[c.right,.78],[c.right*.62,.67],[.044,.56],[.021,.46]],
 [[.021,.46],[.014,.432],[-.014,.432],[-.021,.46]]
 ]
}
export function paintOrganicFlower(ctx,type,options={}){return negativeSpaceFlower(ctx,{...options,rootSegments:options.variation?i=>organicPetal(type,(i+1)*options.variation):organicPetal(type)})}
export function paintOrganicPetal(ctx,type,x,y,size=280,variation=0){const s=type==='old'?narrowedPetal('B'):organicPetal(type,variation);ctx.save();ctx.translate(x,y);ctx.beginPath();for(const [i,[a,b,c,d]]of s.entries()){if(!i)ctx.moveTo(a[0]*size,-(a[1]-.44)*size);ctx.bezierCurveTo(b[0]*size,-(b[1]-.44)*size,c[0]*size,-(c[1]-.44)*size,d[0]*size,-(d[1]-.44)*size)}ctx.closePath();ctx.fillStyle='#f3dcea';ctx.fill();ctx.restore()}
