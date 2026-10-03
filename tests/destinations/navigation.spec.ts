import {test, expect} from '@playwright/test';

test('background photos and search open the same destination records without substituting the editing scene', async ({page}) => {
  const requested: string[] = [];
  await page.route('**/routes/**/route.json', route => {
    requested.push(new URL(route.request().url()).pathname);
    return route.fulfill({status:404,body:'Prepared files are not installed on this device.'});
  });
  await page.goto('/');
  for (const [name, area, id] of [['Qorikancha','Cusco','cusco-qorikancha'], ['Narikala','Tbilisi','tbilisi-narikala'], ['Swayambhu','Kathmandu','kathmandu-swayambhu']]) {
    await page.getByRole('button', {name:`Explore ${name} · ${area}`,exact:true}).click();
    await expect(page.getByRole('heading', {name,exact:true})).toBeVisible();
    await expect(page.getByRole('button', {name:'Try again',exact:true})).toBeVisible();
    expect(requested.at(-1)).toBe(`/routes/${id}/route.json`);
    await expect(page.getByRole('button', {name:'Check the passage'})).toHaveCount(0);
    await page.getByRole('button', {name:'Scene options',exact:true}).click();
    await page.getByRole('button', {name:'Home',exact:true}).click();
    await page.getByRole('textbox', {name:'Explore a place'}).fill(name);
    await page.getByRole('button', {name:`${name} ${area}`,exact:true}).click();
    await expect(page.getByRole('button', {name:'Try again',exact:true})).toBeVisible();
    expect(requested.at(-1)).toBe(`/routes/${id}/route.json`);
    await page.getByRole('button', {name:'Scene options',exact:true}).click();
    await page.getByRole('button', {name:'Home',exact:true}).click();
  }
  expect(requested).toHaveLength(6);
});
