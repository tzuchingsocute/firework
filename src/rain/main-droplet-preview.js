// Opt-in material prototype. Not imported by the live application.
import { createDropletAppearance as createAppearance } from './droplet-appearance.js'
function waterSprite(color, soft) {
 const canvas=document.createElement('canvas');canvas.width=canvas.height=96
 const ctx=canvas.getContext('2d')
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(',')
 const shape=new Path2D('M 48 8 C 46 28 32 43 33 58 C 34 78 61 81 64 60 C 66 43 51 28 48 8 Z')
 // Curved teardrop envelope with a small off-center highlight, not a stretched disk.
 ctx.save();ctx.clip(shape)
 const light=ctx.createRadialGradient(46,59,1,48,55,soft?32:26)
 light.addColorStop(0,'#E8F4F8');light.addColorStop(.2,`rgba(${rgb},.85)`)
 light.addColorStop(.65,`rgba(${rgb},${soft?.3:.5})`);light.addColorStop(1,`rgba(${rgb},0)`)
 ctx.fillStyle=light;ctx.fillRect(0,0,96,96);ctx.restore()
 // Cached softened version; never blur the camera or full effect canvas.
 if(soft){const copy=document.createElement('canvas');copy.width=copy.height=96;copy.getContext('2d').drawImage(canvas,0,0);ctx.clearRect(0,0,96,96);ctx.filter='blur(3px)';ctx.drawImage(copy,0,0)}
 return canvas
}
export function createDropletAppearance(ctx) {
 return createAppearance(ctx,{sprite:waterSprite,mainOnly:true})
}
