import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
test('renders distinct liquid contours at live size and inspection scale',async({page})=>{
 test.skip(!process.env.RAIN_AR_DEV_URL)
 if(process.env.LIQUID_BEFORE) await page.route('**/src/rain/splash-visual.js*',async r=>r.fulfill({contentType:'application/javascript',body:await readFile('/tmp/shape-before.js','utf8')}))
 await page.goto(process.env.RAIN_AR_DEV_URL)
 await page.evaluate(async()=>{
 const {paintSplash,splashType}=await import('/src/rain/splash-visual.js')
 const canvas=document.createElement('canvas');canvas.id='liquid-proof';canvas.width=414;canvas.height=500;document.body.append(canvas)
 const ctx=canvas.getContext('2d');ctx.fillStyle='#172029';ctx.fillRect(0,0,414,500)
 ctx.fillStyle='#e8f4f8';ctx.font='14px sans-serif';ctx.fillText('Actual scale / enlarged contour inspection',15,25)
 const ids=[];for(let id=1;ids.length<8;id++)if(splashType(id)==='droplet')ids.push(id)
 ids.forEach((id,i)=>{const x=48+(i%4)*104,y=75+Math.floor(i/4)*200;paintSplash(ctx,id,x,y,35,-20,1.25,.9,.9,.04);ctx.save();ctx.translate(x,y+85);ctx.scale(5,5);paintSplash(ctx,id,0,0,35,-20,1.25,.9,.9,.04);ctx.restore()})
 })
 await expect(page.locator('#liquid-proof')).toBeVisible()
 await page.locator('#liquid-proof').screenshot({path:`reports/liquid-contours-${process.env.LIQUID_BEFORE?'before':'after'}.png`})
})
