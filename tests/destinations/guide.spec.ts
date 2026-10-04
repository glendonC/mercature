import {test, expect, type Page} from '@playwright/test';

async function openGuide(page: Page) {
  await page.getByRole('button', {name:'Explore Qorikancha · Cusco', exact:true}).click();
  await page.getByRole('button', {name:'Skip', exact:true}).click();
  await expect(page.locator('.guide-screen .ui-dialogue')).toBeVisible();
}

test('the guide goes through the walk, and her answer takes a spot off her map', async ({page}) => {
  test.setTimeout(30000);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openGuide(page);
  await page.getByRole('button', {name:'Go through the route', exact:true}).click();
  const progress = page.locator('.gs-card-meta > span').first();
  await expect(progress).toHaveText(/^1 of \d+$/);
  await page.getByRole('button', {name:'Not there now', exact:true}).click();
  await expect(progress).toHaveText(/^2 of \d+$/);
  const review = await page.evaluate(() => JSON.parse(localStorage.getItem('mercature.route-review.v1.cusco-qorikancha')!));
  expect(review.decisions['0'].verdict).toBe('not-barrier');
});

test('a visitor message she files herself gets a reply in the visitor language, with Copy inside it', async ({page}) => {
  test.setTimeout(30000);
  await page.route('**/routes/cusco-qorikancha/**', route => route.fulfill({status:404, body:'Prepared files are not installed on this device.'}));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openGuide(page);
  await page.getByRole('button', {name:'Read messages', exact:true}).click();
  // No model is stored in a fresh browser, so she places it herself.
  await page.getByRole('button', {name:/myself/i}).click();
  await page.locator('.route-marker[aria-label^="Calle Loreto, 340 to 350 m"]').click();
  const reply = page.locator('.gs-copybox');
  await expect(reply).toBeVisible();
  await expect(reply.getByRole('button', {name:/copy/i})).toBeVisible();
  const review = await page.evaluate(() => JSON.parse(localStorage.getItem('mercature.route-review.v1.cusco-qorikancha')!));
  expect(review.messages[0]).toMatchObject({id:'example-ko-steps', spot:'steps-340-350', answer:null});
});
