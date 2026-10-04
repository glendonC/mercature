import {test, expect} from '@playwright/test';

test('a prepared place opens from Home, from its package or its local record', async ({page}) => {
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
  await expect(page.getByRole('button', {name:'Check the passage'})).toHaveCount(0);
  await page.locator('.menu-button').click();
  await page.getByRole('button', {name:'Home', exact:true}).click();
  // Without its local record Narikala is not offered on Home at all.
  expect(requested).toContain('/routes/tbilisi-narikala/route.json');
  await expect(page.getByRole('button', {name:'Explore Narikala · Tbilisi', exact:true})).toHaveCount(0);
});
