import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('petal arrangement and center comparisons',async({page})=>{await page.goto('/previews/petal-arrangement.html');await expect(page.locator('#layouts')).toHaveJSProperty('width',900);for(const id of ['layouts','centers','detail','comparison','live']){const url=await page.locator('#'+id).evaluate(c=>c.toDataURL());await writeFile(`reports/petal-arrangement-${id}.png`,Buffer.from(url.split(',')[1],'base64'))}})
