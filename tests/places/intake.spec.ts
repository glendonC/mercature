import {test,expect} from '@playwright/test';
import {validateBoundary} from '../../src/places/store';
test('geographic scope rejects reversed or nonfinite coordinates',()=>{
  expect(()=>validateBoundary({west:127,south:37,east:127.1,north:37.1})).not.toThrow();
  for(const bounds of [{west:2,south:0,east:1,north:1},{west:0,south:90,east:1,north:91},{west:NaN,south:0,east:1,north:1}])expect(()=>validateBoundary(bounds)).toThrow();
});
test('a local evidence workspace preserves notes and original files across reopening',async({page})=>{
  await page.goto('/');
  await page.getByRole('textbox',{name:'Find your place'}).fill('Test orchard');
  await page.getByRole('button',{name:'Open place',exact:true}).click();
  await expect(page.getByText('Analysis unavailable',{exact:true})).toBeVisible();
  await page.getByLabel('Area and measurement notes').fill('North gate needs an independent width check.');
  await page.getByRole('button',{name:'Save place',exact:true}).click();
  await page.getByLabel('I have permission to store these files locally.').check();
  await page.locator('input[type=file][multiple]').setInputFiles({name:'evidence.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBZkAAAAASUVORK5CYII=','base64')});
  await expect(page.locator('.workspace-notices').getByRole('status')).toContainText('saved locally');
  await page.reload();
  await page.getByRole('button',{name:/My places/}).click();
  await page.getByRole('button',{name:/Test orchard/}).click();
  await expect(page.getByLabel('Area and measurement notes')).toHaveValue('North gate needs an independent width check.');
  await expect(page.getByRole('img',{name:'evidence.png'})).toBeVisible();
  await expect(page.getByText('Analysis unavailable',{exact:true})).toBeVisible();
});
