import {test, expect} from '@playwright/test';

test('the farm example opens only from its own address, and its getting-ready steps hand it to the workspace', async ({page}) => {
  test.setTimeout(20000);
  await page.goto('/');
  await expect(page.getByRole('button', {name:/Noor/})).toHaveCount(0);
  await page.goto('/?place=farm');
  // The address reads plainly again, so a reload goes Home.
  await expect(page).toHaveURL(url => !url.search);
  await expect(page.getByText('Example', {exact:true}).first()).toBeVisible();
  await expect(page.locator('li[data-step=paths]')).toContainText('3 of 4 reachable');
  await expect(page.locator('li[data-step=model]')).toContainText(/Ready|Loading|Use without AI/);
  await expect(page.getByRole('status').filter({hasText:"Noor's farm is ready."})).toBeVisible();
  await expect(page.locator('.farm-ready')).toHaveCount(0, {timeout: 8000});
  await expect(page.getByRole('button', {name:'View options', exact:true})).toBeVisible();
});
