import {test,expect} from '@playwright/test'
test('manual live particle firework renders once and completes all child lifetimes',async({page})=>{
 await page.goto('/')
 await page.locator('#controls-toggle').click()
 await page.locator('#visual-rain > summary').click()
 await page.getByRole('button',{name:'测试烟花（占位）'}).click()
 const canvas=page.locator('canvas[data-trigger-count]')
 await expect(canvas).toHaveAttribute('data-trigger-count','1')
 await page.waitForTimeout(130)
 await page.locator('.live-room').screenshot({path:'reports/firework-placeholder.png'})
 await page.waitForTimeout(5200)
 await expect(canvas).toHaveAttribute('data-trigger-count','1')
 expect(await canvas.evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,414,896).data;return d.some((v,i)=>i%4===3&&v>0)})).toBe(false)
})
