import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('full organic petal contour candidates',async({page})=>{await page.goto('/previews/organic-petals.html');await expect(page.locator('#petals')).toHaveJSProperty('width',1100);for(const id of ['petals','flowers','detail','comparison','variation','glow','live']){const url=await page.locator('#'+id).evaluate(c=>c.toDataURL());await writeFile(`reports/organic-petals-${id}.png`,Buffer.from(url.split(',')[1],'base64'))}})
