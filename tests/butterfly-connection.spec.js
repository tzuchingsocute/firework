import {test,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
test('before after contour and six view regression',async({page})=>{await page.goto('/previews/butterfly-connection.html');await expect(page.locator('#base')).toHaveJSProperty('width',780);for(const id of ['detail','base','views','glow','live']){const url=await page.locator('#'+id).evaluate(c=>c.toDataURL());await writeFile(`reports/butterfly-connection-${id}.png`,Buffer.from(url.split(',')[1],'base64'))}})
