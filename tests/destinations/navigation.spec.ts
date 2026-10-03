import {test, expect} from '@playwright/test';

test('background photos and search results open the same place, from its package or its local record', async ({page}) => {
  test.setTimeout(30000);
  const requested: string[] = [];
  await page.route('**/routes/**/route.json', route => {
    requested.push(new URL(route.request().url()).pathname);
    return route.fulfill({status:404, body:'Prepared files are not installed on this device.'});
  });
  await page.goto('/');
  const reveal = page.getByRole('region', {name:'Qorikancha', exact:true});
  await page.getByRole('button', {name:'Explore Qorikancha · Cusco', exact:true}).click();
  await expect(reveal).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name:'Home', exact:true}).click();
  await page.getByRole('textbox', {name:'Explore a place'}).fill('Cusco');
  await page.getByRole('button', {name:'Qorikancha Cusco', exact:true}).click();
  await expect(reveal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name:'Check the passage'})).toHaveCount(0);
  await page.getByRole('button', {name:'Home', exact:true}).click();
  // Without its local record Narikala is not offered, only kept as an unlabeled background photo.
  expect(requested).toContain('/routes/tbilisi-narikala/route.json');
  await expect(page.getByRole('button', {name:'Explore Narikala · Tbilisi', exact:true})).toHaveCount(0);
});
