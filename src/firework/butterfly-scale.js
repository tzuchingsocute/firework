import {groupedOpenness} from './butterfly-openness-diversity.js'
import {paintButterfly} from './butterfly-shape.js'
export const scaleBands=[{name:'Large',min:1.3,max:1.6,weight:.2},{name:'Medium',min:.9,max:1.2,weight:.55},{name:'Small',min:.55,max:.8,weight:.25}]
export function scaledButterflies(seed=6062,count=20){let n=seed^0x5ca1;const r=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296),base=groupedOpenness(seed,count).samples
 const samples=base.map(v=>{let q=r(),band=scaleBands.at(-1);for(const b of scaleBands){q-=b.weight;if(q<0){band=b;break}}return {...v,scale:band.min+r()*(band.max-band.min),scaleGroup:band.name}})
 return {seed,base,samples,counts:Object.fromEntries(scaleBands.map(b=>[b.name,samples.filter(v=>v.scaleGroup===b.name).length]))}
}
// Render at the unchanged model size, then uniformly scale the whole projection.
// Glow scales with the same object, preserving its relationship to the silhouette.
export function paintScaledButterfly(ctx,v,x,y,size=48){ctx.save();ctx.translate(x,y);ctx.scale(v.scale??1,v.scale??1);paintButterfly(ctx,v,0,0,size,1);ctx.restore()}
export function scaleMatrix(canvas,views,columns=5){canvas.width=columns*250;canvas.height=Math.ceil(views.length/columns)*270;const ctx=canvas.getContext('2d');ctx.fillStyle='#101522';ctx.fillRect(0,0,canvas.width,canvas.height);views.forEach((v,i)=>{const x=i%columns*250+125,y=Math.floor(i/columns)*270+115;paintScaledButterfly(ctx,v,x,y);ctx.textAlign='center';ctx.fillStyle='#dce3f3';ctx.font='13px sans-serif';ctx.fillText(`${v.scaleGroup} / ${v.scale.toFixed(2)}x`,x,y+115)})}
