import {test,expect} from '@playwright/test'
import {writeFile,readFile} from 'node:fs/promises'
test('authored transparent peak static candidate',async({page})=>{
 await page.goto('/')
 const ref=await readFile('/var/folders/sx/wydqf33s1ll_sxy30t66v_c00000gn/T/codex-clipboard-17e3cecf-e0b3-41cb-aa1b-5a6f515d9c77.png')
 const result=await page.evaluate(async ref=>{
  const {createDensePeak,paintDensePeak}=await import('/src/firework/dense-peak.js');const {createDensePeak:oldCreate,paintDensePeak:oldPaint}=await import('/tests/fixtures/dense-peak-before-tips.js');const {paintBrushTip}=await import('/src/firework/brush-tips.js');const out={},stats=[]
  const peak=createDensePeak(1201),c=document.createElement('canvas');c.width=c.height=800;let ctx=c.getContext('2d');ctx.translate(400,400);paintDensePeak(ctx,peak);out.transparent=c.toDataURL()
  for(const budget of [528,3600]){const b=createDensePeak(1201,budget),costs=[];for(let i=0;i<50;i++){ctx.clearRect(-400,-400,800,800);const t=performance.now();paintDensePeak(ctx,b);costs.push(performance.now()-t)}costs.sort((a,b)=>a-b);stats.push({budget,median:costs[25],p95:costs[47]})}
  const preview=document.createElement('canvas');preview.width=414;preview.height=896;ctx=preview.getContext('2d');ctx.fillStyle='#15202b';ctx.fillRect(0,0,414,896);ctx.translate(207,390);ctx.scale(.48,.48);paintDensePeak(ctx,peak);out.live=preview.toDataURL()
  const seeds=document.createElement('canvas');seeds.width=1600;seeds.height=800;ctx=seeds.getContext('2d');ctx.fillStyle='#10131c';ctx.fillRect(0,0,1600,800);for(const [i,seed]of [1201,42,917,3061].entries()){ctx.save();ctx.translate(i*400+200,400);ctx.scale(.52,.52);paintDensePeak(ctx,createDensePeak(seed,3600,{paletteIndex:i}));ctx.restore()}out.seeds=seeds.toDataURL()
  const budgets=document.createElement('canvas');budgets.width=1600;budgets.height=800;ctx=budgets.getContext('2d');ctx.fillStyle='#10131c';ctx.fillRect(0,0,1600,800);for(const [i,n]of [528,3600].entries()){ctx.save();ctx.translate(i*800+400,400);paintDensePeak(ctx,createDensePeak(1201,n));ctx.restore()}out.budgets=budgets.toDataURL()
  const tips=document.createElement('canvas');tips.width=1000;tips.height=250;ctx=tips.getContext('2d');ctx.fillStyle='#15202b';ctx.fillRect(0,0,1000,250);for(const [i,type]of ['natural','star','butterfly','burst','flower'].entries()){ctx.fillStyle='white';ctx.font='16px sans-serif';ctx.fillText(type,i*200+40,30);ctx.save();ctx.translate(i*200+100,130);ctx.scale(2,2);paintBrushTip(ctx,type,0,0,17,0,'#d7beef');if(type==='natural'){ctx.fillStyle='#e9dcff';for(let j=0;j<30;j++)ctx.fillRect(-35+j,Math.sin(j)*.6,1,1)}ctx.restore()}out.tips=tips.toDataURL()
  const img=new Image();img.src=ref;await img.decode();const compare=document.createElement('canvas');compare.width=2400;compare.height=840;ctx=compare.getContext('2d');ctx.fillStyle='#10131c';ctx.fillRect(0,0,2400,840)
  // Reference crop excludes the three right-hand large 3D stars, via local masks.
  ctx.drawImage(img,200,145,880,780,0,40,800,780)
  for(const [x,y,w,h]of [[466,65,110,110],[635,225,105,125],[655,535,130,150]]){ctx.fillStyle='#10131c';ctx.fillRect(x,y,w,h)}
  ctx.save();ctx.translate(1200,440);oldPaint(ctx,oldCreate(1201));ctx.restore();ctx.save();ctx.translate(2000,440);paintDensePeak(ctx,peak);ctx.restore();ctx.fillStyle='white';ctx.font='18px sans-serif';ctx.fillText('Reference / large decorative stars excluded',15,25);ctx.fillText('Authored peak candidate',815,25);ctx.fillText('High density / 3600 particles',1615,25);out.comparison=compare.toDataURL()
  return {out,stats,paths:peak.strokes.length,corner:c.getContext('2d').getImageData(0,0,1,1).data[3]}
 },`data:image/png;base64,${ref.toString('base64')}`)
 expect(result.paths).toBeGreaterThanOrEqual(42);expect(result.corner).toBe(0)
 await writeFile('reports/brush-tips-performance.json',JSON.stringify(result.stats,null,2))
 for(const [name,url]of Object.entries(result.out))await writeFile(`reports/brush-tips-${name}.png`,Buffer.from(url.split(',')[1],'base64'))
})
