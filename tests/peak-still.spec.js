import {test,expect} from '@playwright/test'
import {writeFile,readFile} from 'node:fs/promises'
test('authored transparent peak static candidate',async({page})=>{
 await page.goto('/')
 const ref=await readFile('/var/folders/sx/wydqf33s1ll_sxy30t66v_c00000gn/T/codex-clipboard-17e3cecf-e0b3-41cb-aa1b-5a6f515d9c77.png')
 const result=await page.evaluate(async ref=>{
  const {paintPeakStill,peakPaths}=await import('/src/firework/peak-still.js');const out={}
  const c=document.createElement('canvas');c.width=800;c.height=800;let ctx=c.getContext('2d');ctx.translate(400,400);paintPeakStill(ctx);out.transparent=c.toDataURL()
  const preview=document.createElement('canvas');preview.width=414;preview.height=896;ctx=preview.getContext('2d');ctx.fillStyle='#15202b';ctx.fillRect(0,0,414,896);ctx.translate(207,390);ctx.scale(.48,.48);paintPeakStill(ctx);out.live=preview.toDataURL()
  const img=new Image();img.src=ref;await img.decode();const compare=document.createElement('canvas');compare.width=1600;compare.height=840;ctx=compare.getContext('2d');ctx.fillStyle='#10131c';ctx.fillRect(0,0,1600,840)
  // Reference crop excludes the three right-hand large 3D stars, via local masks.
  ctx.drawImage(img,200,145,880,780,0,40,800,780)
  for(const [x,y,w,h]of [[466,65,110,110],[635,225,105,125],[655,535,130,150]]){ctx.fillStyle='#10131c';ctx.fillRect(x,y,w,h)}
  ctx.save();ctx.translate(1200,440);paintPeakStill(ctx);ctx.restore();ctx.fillStyle='white';ctx.font='18px sans-serif';ctx.fillText('Reference / large decorative stars excluded',15,25);ctx.fillText('Authored peak candidate',815,25);out.comparison=compare.toDataURL()
  return {out,paths:peakPaths.length,corner:c.getContext('2d').getImageData(0,0,1,1).data[3]}
 },`data:image/png;base64,${ref.toString('base64')}`)
 expect(result.paths).toBe(15);expect(result.corner).toBe(0)
 for(const [name,url]of Object.entries(result.out))await writeFile(`reports/peak-still-${name}.png`,Buffer.from(url.split(',')[1],'base64'))
})
