import {test, expect, type Page} from '@playwright/test';

async function openRoute(page: Page, tabs = true) {
  await page.getByRole('button', {name:'Explore Qorikancha · Cusco', exact:true}).click();
  await page.getByRole('button', {name:'Skip', exact:true}).click();
  if (tabs) await expect(page.getByRole('tab', {name:'Place', exact:true})).toHaveAttribute('aria-selected', 'true');
}

test('a decision on a recorded photo is kept by stretch and writes the visitor note', async ({page}) => {
  test.setTimeout(30000);
  // The published package only, as on any host without the local records.
  await page.route('**/routes/**', route => route.fulfill({status:404, body:'Prepared files are not installed on this device.'}));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openRoute(page);
  const loreto = page.getByRole('button', {name:/^Calle Loreto, 340 to 350 m/});
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
  await expect(page.getByRole('button', {name:/^Calle Loreto, 340 to 350 m, Barrier confirmed$/})).toBeVisible();
});

test('the keyboard opens a card at its Close button, returns to the marker and reaches the message box before the map', async ({page}) => {
  test.setTimeout(30000);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openRoute(page);
  const marker = page.getByRole('button', {name:/^Calle Loreto, 340 to 350 m/});
  await marker.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', {name:'Calle Loreto, 340 to 350 m', exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', {name:'Close', exact:true})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(marker).toBeFocused();
  await page.getByRole('tab', {name:'Messages', exact:true}).click();
  const panel = page.getByRole('tabpanel', {name:'Messages'});
  await expect(panel.getByRole('textbox', {name:'Visitor message'})).toBeVisible();
  expect(await panel.evaluate(view => !!(view.querySelector('textarea')!.compareDocumentPosition(view.querySelector('.route-marker')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
});

test('the new route screen files a visitor message on the spot she taps and counts it on the map', async ({page}) => {
  test.setTimeout(30000);
  await page.goto('/?ui=v2');
  await page.evaluate(() => localStorage.clear());
  await openRoute(page, false);
  await page.locator('.ri-row', {hasText:'Algunas partes'}).click();
  await page.getByRole('button', {name:'Use without AI', exact:true}).click();
  await expect(page.getByText('Tap the spot on the map.')).toBeVisible();
  await page.getByRole('button', {name:/^Calle Loreto, 340 to 350 m/}).click();
  await expect(page.getByText('Filed. The reply below uses what your map says.')).toBeVisible();
  await expect(page.getByRole('button', {name:'Calle Loreto, 340 to 350 m, 1 message from visitors'})).toBeVisible();
  const review = await page.evaluate(() => JSON.parse(localStorage.getItem('mercature.route-review.v1.cusco-qorikancha')!));
  expect(review.messages[0]).toMatchObject({id:'example-es-hard', spot:'steps-340-350', answer:null});
});
