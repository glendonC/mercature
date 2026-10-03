import {test, expect, type Page} from '@playwright/test';

async function openRoute(page: Page) {
  await page.getByRole('button', {name:'Explore Qorikancha · Cusco', exact:true}).click();
  await page.getByRole('button', {name:'Skip', exact:true}).click();
  await expect(page.getByRole('tab', {name:'Place', exact:true})).toHaveAttribute('aria-selected', 'true');
}

test('a decision on a recorded photo is kept by stretch and writes the visitor note', async ({page}) => {
  test.setTimeout(30000);
  // The published package only, as on any host without the local records.
  await page.route('**/routes/**', route => route.fulfill({status:404, body:'Prepared files are not installed on this device.'}));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openRoute(page);
  const loreto = page.getByRole('button', {name:/^Stone steps on Calle Loreto, 340 to 350 m/});
  await loreto.click();
  await expect(page.getByText('Model suggestion, unverified').first()).toBeVisible();
  await page.getByRole('button', {name:'Confirm', exact:true}).click();
  await expect(loreto).toHaveAccessibleName(/Barrier confirmed$/);
  await page.getByRole('tab', {name:'Changes', exact:true}).click();
  await expect(page.getByText('Steps on Calle Loreto, about 340 m along the walk.')).toBeVisible();
  const review = await page.evaluate(() => JSON.parse(localStorage.getItem('mercature.route-review.v1.cusco-qorikancha')!));
  expect(Object.keys(review.decisions)).toEqual(['34']);
  expect(review.decisions['34'].verdict).toBe('barrier');
  await page.getByRole('button', {name:'Home', exact:true}).click();
  await openRoute(page);
  await expect(page.getByRole('button', {name:/^Stone steps on Calle Loreto, 340 to 350 m, Barrier confirmed$/})).toBeVisible();
});
