import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('root and actual center visual checks',async({page})=>{await page.goto('/previews/flower-negative-space.html');await expect(page.locator('#centers')).toHaveJSProperty('width',1250);for(const id of ['centers','roots','spacing','detail','comparison','glow','live']){const url=await page.locator('#'+id).evaluate(c=>c.toDataURL());await writeFile(`reports/flower-negative-space-${id}.png`,Buffer.from(url.split(',')[1],'base64'))}})
