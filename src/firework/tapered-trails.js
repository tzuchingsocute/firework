// Per-instance render metadata only: no emission, trajectory or lifecycle changes.
export function configureTaperedTrails(trail,seed){
 const selected=[];let n=(seed^0x71ac93)>>>0;const random=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)
 for(const h of trail.head.heads){const spec=trail.head.tail.peak.strokes[h.id].spec;if(spec==='fine'||random()>(spec==='bold'?.72:.4))continue;selected.push(h.id)
  for(const p of trail.particles)if(p.headId===h.id){const u=Math.max(0,Math.min(1,(p.birth-h.birth)/h.duration)),ease=u*u*(3-2*u);Object.defineProperties(p,{taperWidth:{value:.65+2.6*ease},taperStretch:{value:1.1+.5*ease}})}
 }
 return selected
}
