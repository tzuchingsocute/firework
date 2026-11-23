import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('variable secondary ray contours',async({page})=>{await page.goto('/previews/secondary-ray-pairs.html');await expect(page.locator('#counts')).toHaveJSProperty('width',1040);for(const id of ['counts','pairs','asymmetry','dense']){const url=await page.locator('#'+id).evaluate(c=>c.toDataURL());await writeFile(`reports/secondary-ray-pairs-${id}.png`,Buffer.from(url.split(',')[1],'base64'))}})
