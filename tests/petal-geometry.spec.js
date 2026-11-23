import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('petal contours and unchanged five-petal layout',async({page})=>{await page.goto('/previews/petal-geometry.html');await expect(page.locator('#petals')).toHaveJSProperty('width',1000);for(const id of ['petals','detail','flowers','comparison']){const url=await page.locator('#'+id).evaluate(c=>c.toDataURL());await writeFile(`reports/petal-geometry-${id}.png`,Buffer.from(url.split(',')[1],'base64'))}})
