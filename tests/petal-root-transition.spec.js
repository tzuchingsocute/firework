import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('root-only transition visual comparisons',async({page})=>{await page.goto('/previews/petal-root-transition.html');await expect(page.locator('#comparison')).toHaveJSProperty('width',1200);for(const id of ['comparison','detail','glow','live']){const url=await page.locator('#'+id).evaluate(c=>c.toDataURL());await writeFile(`reports/petal-root-transition-${id}.png`,Buffer.from(url.split(',')[1],'base64'))}})
