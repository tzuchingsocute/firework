// Reuse existing trail samples: fixed per-particle variation, no additional particles.
export function tipParticleStyle(index,age){
 const n=(Math.imul(index+17,2654435761)>>>0),r=(n&65535)/65535;
 const scale=index%7===0?1.8:index%3===0?.4:1;
 return{scale:scale*(.85+r*.3),side:((n>>>16)/65535-.5)*(4+age*15),along:-(index%4)*1.3,shape:index%3}
}
export function paintTipFragment(ctx,p,color){
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=Math.min(.95,.65+p.brightness*.3);const w=p.size*2.5,h=w*(p.shape===1?.32:.58);ctx.shadowColor=color;ctx.shadowBlur=1.6;ctx.fillStyle='#fff1e6';ctx.beginPath();ctx.moveTo(-w,0);ctx.lineTo(-w*.18,-h);ctx.lineTo(w*.85,p.shape===2?-h*.15:0);ctx.lineTo(w*.08,h*.8);ctx.closePath();ctx.fill();ctx.restore()
}
