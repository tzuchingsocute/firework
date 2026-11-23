import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('five-colour proportion and layering diagnostics',async({page})=>{await page.goto('/previews/layered-flower.html');await expect(page.locator('#ratios')).toHaveJSProperty('width',900);for(const id of ['old','ratios','overlap','material','detail','live']){const url=await page.locator('#'+id).evaluate(c=>c.toDataURL());await writeFile(`reports/layered-flower-${id}.png`,Buffer.from(url.split(',')[1],'base64'))}})
