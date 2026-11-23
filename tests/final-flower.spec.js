import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('reconstructed short-root flower',async({page})=>{await page.goto('/previews/final-flower.html');await expect(page.locator('#petal')).toHaveJSProperty('width',700);for(const id of ['petal','candidates','comparison','material','silhouette','live']){const url=await page.locator('#'+id).evaluate(c=>c.toDataURL());await writeFile(`reports/final-flower-${id}.png`,Buffer.from(url.split(',')[1],'base64'))}})
