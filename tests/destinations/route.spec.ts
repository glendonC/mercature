import {test, expect, type Page} from '@playwright/test';

async function openRoute(page: Page) {
  await page.getByRole('button', {name:'Explore Qorikancha · Cusco', exact:true}).click();
  await page.getByRole('button', {name:'Skip', exact:true}).click();
  await expect(page.getByRole('heading', {name:'Messages', exact:true})).toBeVisible();
}

test('a visitor message is filed on the spot she taps, counted on the map and answered from her map', async ({page}) => {
  test.setTimeout(30000);
  // The published package only, as on any host without the local records.
  await page.route('**/routes/**', route => route.fulfill({status:404, body:'Prepared files are not installed on this device.'}));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openRoute(page);
  await page.locator('.ri-row', {hasText:'Algunas partes'}).click();
  // No model is stored in a fresh browser, so she files it herself.
  await page.getByRole('button', {name:'Use without AI', exact:true}).click();
  await expect(page.getByText('Tap the spot on the map.')).toBeVisible();
  await page.getByRole('button', {name:/^Calle Loreto, 340 to 350 m/}).click();
  await expect(page.getByText('Filed. The reply below uses what your map says.')).toBeVisible();
  await expect(page.getByRole('button', {name:'Calle Loreto, 340 to 350 m, 1 message from visitors'})).toBeVisible();
  await page.getByRole('button', {name:'Español', exact:true}).last().click();
  await expect(page.locator('.ri-reply')).toContainText('escalones');
  const review = await page.evaluate(() => JSON.parse(localStorage.getItem('mercature.route-review.v1.cusco-qorikancha')!));
  expect(review.messages[0]).toMatchObject({id:'example-es-hard', spot:'steps-340-350', answer:null});
});

test('a spot shows every mark with its legend, and removing it takes it out of the visitor note', async ({page}) => {
  test.setTimeout(30000);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openRoute(page);
  await page.getByRole('button', {name:/^Plaza de Armas, 0 to 10 m/}).click();
  const legend = page.locator('.ri-legend');
  await expect(legend).toContainText('Steps');
  await expect(legend).toContainText('Kerb beside the route');
  await expect(legend).toContainText('Model suggestion');
  await page.getByRole('button', {name:'Remove', exact:true}).click();
  await expect(page.getByText('Removed from your map')).toBeVisible();
  const review = await page.evaluate(() => JSON.parse(localStorage.getItem('mercature.route-review.v1.cusco-qorikancha')!));
  expect(review.decisions['0'].verdict).toBe('not-barrier');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Steps 3')).toBeVisible();
});

test('the panel comes before the map, so the keyboard reaches the messages first', async ({page}) => {
  await page.goto('/');
  await openRoute(page);
  const order = await page.evaluate(() => { const panel = document.querySelector('.ri-panel')!, marker = document.querySelector('.route-marker')!; return !!(panel.compareDocumentPosition(marker) & Node.DOCUMENT_POSITION_FOLLOWING); });
  expect(order).toBe(true);
  await page.locator('.ri-row').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', {name:'All messages'})).toBeVisible();
  await expect(page.getByRole('button', {name:'All messages'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', {name:'Messages', exact:true})).toBeVisible();
  await expect(page.locator('.ri-row').first()).toBeFocused();
});
