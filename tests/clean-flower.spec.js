import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('independent clean flower matrices',async({page})=>{await page.goto('/previews/clean-flower.html');await expect(page.locator('#base')).toHaveJSProperty('width',270);for(const id of ['base','variants','views','material','mixed','live']){const url=await page.locator('#'+id).evaluate(c=>c.toDataURL());await writeFile(`reports/clean-flower-${id}.png`,Buffer.from(url.split(',')[1],'base64'))}})
