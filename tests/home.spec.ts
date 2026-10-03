import { test, expect } from '@playwright/test';
test('a place can begin without GPS or a network search', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'An editable spatial accessibility model'})).toBeVisible();
  await page.getByRole('textbox', {name:'Find your place'}).fill('My visitor garden');
  await page.getByRole('button', {name:'Open place',exact:true}).click();
  await expect(page.getByRole('heading', {name:'My visitor garden',exact:true})).toBeVisible();
});
