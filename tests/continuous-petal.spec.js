import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('continuous petal reconstruction proof',async({page})=>{await page.goto('/previews/continuous-petal.html');await expect(page.locator('#before')).toHaveJSProperty('width',700);for(const id of ['before','candidates','controls','flowers','comparison','silhouette','live']){const url=await page.locator('#'+id).evaluate(c=>c.toDataURL());await writeFile(`reports/continuous-petal-${id}.png`,Buffer.from(url.split(',')[1],'base64'))}})
