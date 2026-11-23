import {narrowedPetal,negativeSpaceFlower} from './flower-negative-space.js'
export function rootTransition(variant='B'){
 const s=narrowedPetal('B'),config={A:{inner:.024,height:.535,cap:.435},B:{inner:.034,height:.55,cap:.432},C:{inner:.042,height:.56,cap:.43}}[variant]
 if(!config)throw new Error('Unknown root transition')
 // Preserve both root widths, outer control points and the entire tip sections.
 // Give the root a gentler outward tangent rather than a straight pointed wedge.
 s[0][1]=[-config.inner,config.height];s[3][2]=[config.inner,config.height]
 const root=s[0][0][0];s[4][1]=[Math.abs(root)*.65,config.cap];s[4][2]=[-Math.abs(root)*.65,config.cap]
 return s
}
export function paintRootTransition(ctx,variant,options={}){return negativeSpaceFlower(ctx,{...options,rootSegments:variant==='before'?null:rootTransition(variant)})}
