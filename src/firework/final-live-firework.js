// Thin live adapter: the confirmed preview owns all visual and motion settings.
import {createWholePreview,paintWholePreview,disposeWholeGroup,intervals,attachLimitedChain} from './whole-firework-preview.js'
import {createLiveFirework,paintLiveFirework} from './live-particles.js'
import {chooseCoordinatedPalette,assignCoordinatedColors} from './coordinated-palette-preview.js'
import {paletteContext} from './firework-color-preview.js'

// Precomputed lifecycle events keep per-frame accounting allocation-free. A suffix
// maximum reserves all future emissions without reserving an expired peak forever.
export function lifecycleCensus(spans){
 const deltas=new Map();for(const [a,b] of spans){if(b<=a)continue;deltas.set(a,(deltas.get(a)||0)+1);deltas.set(b,(deltas.get(b)||0)-1)}
 const times=[...deltas.keys()].sort((a,b)=>a-b),counts=[],remaining=[];let count=0
 for(const time of times){count+=deltas.get(time);counts.push(count)}
 for(let i=counts.length-1;i>=0;i--)remaining[i]=Math.max(counts[i],remaining[i+1]||0)
 return age=>{let lo=0,hi=times.length;while(lo<hi){const m=(lo+hi)>>>1;if(times[m]<=age)lo=m+1;else hi=m}return{particles:counts[lo-1]||0,reservedParticles:Math.max(counts[lo-1]||0,remaining[lo]||0)}}
}
export function createFinalLiveFirework(seed,{role,available=6000}={}){
 const model=role==='main'?createWholePreview(seed):createLiveFirework(seed,{role}),minimumReservation=model.peak??model.particleReservation
 if(minimumReservation>available){disposeWholeGroup({before:[],after:[model]});return{accepted:false,minimumReservation}}
 if(role==='main')attachLimitedChain(model,seed,Math.max(0,available-minimumReservation))
 const palette=chooseCoordinatedPalette(seed);assignCoordinatedColors(model,palette,seed)
 return{accepted:true,model,palette,duration:model.duration,minimumReservation,census:lifecycleCensus(model.intervals??intervals(model))}
}
export function paintFinalLiveFirework(ctx,instance,age,position,bounds,scale){
 const target=paletteContext(ctx,instance.palette.softPalette)
 if(instance.model.special)paintWholePreview(target,instance.model,age,position,bounds,scale)
 else paintLiveFirework(target,instance.model,age,position,bounds,scale)
}
export function disposeFinalLiveFirework(instance){disposeWholeGroup({before:[],after:[instance.model]})}
