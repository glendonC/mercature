import {test, expect, type Page} from '@playwright/test';

async function openCanvas(page: Page) {
  await page.goto('/');
  await page.getByRole('button', {name:/^Noor's farm/}).click();
  await page.getByRole('button', {name:'Enter',exact:true}).click();
  await expect(page.getByRole('tab', {name:'Place',exact:true})).toHaveAttribute('aria-selected','true');
}
async function linkMessage(page: Page) {
  await page.getByRole('tab', {name:'Messages',exact:true}).click();
  await page.getByLabel('Original visitor message').fill('커피 자루 때문에 시음 테이블로 가기 어려웠어요.');
  await page.getByRole('button', {name:'Find the spot',exact:true}).click();
  await expect(page.getByRole('button', {name:'Yes, this spot'})).toBeVisible();
  await expect(page.getByLabel('Choose a spot',{exact:true})).toHaveValue('');
  await page.getByLabel('Choose a spot',{exact:true}).selectOption('coffee-sacks');
  await page.getByRole('button', {name:'Yes, this spot'}).click();
}
test('a message stays linked while tabs change and every path is compared before saving', async ({page}) => {
  await openCanvas(page);
  await linkMessage(page);
  await page.getByRole('button', {name:'Storage corner',exact:true}).click();
  const table = page.getByRole('table',{name:'All path results'});
  await expect(table.getByRole('row').filter({hasText:'Tasting table'})).toHaveText('Tasting tableBlockedConnected');
  await expect(table.getByRole('row')).toHaveCount(5);
  await page.getByRole('tab',{name:'Place',exact:true}).click();
  await page.getByRole('tab',{name:'Changes',exact:true}).click();
  await expect(table.getByRole('row').filter({hasText:'Tasting table'})).toHaveText('Tasting tableBlockedConnected');
  await page.getByLabel('Note for this plan').fill('Confirm with the operator before moving anything.');
  await page.getByRole('button',{name:'Save plan',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Plan saved.'})).toBeVisible();
  const plans = await page.evaluate(() => JSON.parse(localStorage.getItem('mercature.improvement-plans.v1')!).plans);
  expect(plans).toHaveLength(1);
  expect(plans[0].origin.originalText).toBe('커피 자루 때문에 시음 테이블로 가기 어려웠어요.');
  expect(plans[0].origin.language).toBe('ko');
  expect(plans[0].notes).toBe('Confirm with the operator before moving anything.');
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('button',{name:/Move coffee sacks/}).click();
  await expect(page.getByRole('heading',{name:'Plan saved.'})).toBeVisible();
});
test('opening the tasting path cannot conceal a newly blocked restroom path', async ({page}) => {
  await openCanvas(page); await linkMessage(page);
  await page.getByRole('button',{name:'Beside the water tank',exact:true}).click();
  const table = page.getByRole('table');
  await expect(table.getByRole('row').filter({hasText:'Tasting table'})).toHaveText('Tasting tableBlockedConnected');
  await expect(table.getByRole('row').filter({hasText:'Restroom'})).toHaveText('RestroomConnectedBlocked');
  await expect(page.getByText('New problem: Restroom',{exact:true})).toBeVisible();
  await expect(page.locator('.place-inspector .primary')).toHaveText('Try another position');
  await page.getByRole('button',{name:'Try another position'}).click();
  await page.getByRole('button',{name:'Storage corner',exact:true}).click();
  await expect(table.getByRole('row').filter({hasText:'Restroom'})).toHaveText('RestroomConnectedConnected');
});
for (const size of [{width:1280,height:800},{width:390,height:844}]) {
  test(`persistent canvas and contextual controls fit at ${size.width}`, async ({page}) => {
    await page.setViewportSize(size); await page.emulateMedia({reducedMotion:'reduce'});
    await openCanvas(page);
    const start = await page.locator('.place-scene').boundingBox();
    await page.getByRole('tab',{name:'Messages',exact:true}).click();
    await page.getByLabel('Original visitor message').fill('A visitor message');
    const withForm = await page.locator('.place-scene').boundingBox();
    expect(withForm!.height).toBeCloseTo(start!.height,0);
    expect(withForm!.width).toBeCloseTo(start!.width,0);
    await linkMessage(page);
    await page.getByRole('button',{name:'Storage corner',exact:true}).click();
    await expect(page.getByRole('region',{name:'Guide dialogue'}).getByRole('button')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    await page.screenshot({path:`.local/canvas-reviewed-${size.width}.png`,fullPage:true,animations:'disabled'});
  });
}
test('keyboard tab navigation retains the message draft', async ({page}) => {
  await openCanvas(page);
  await page.getByRole('tab',{name:'Place',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'Messages',exact:true})).toBeFocused();
  await page.getByLabel('Original visitor message').fill('Keep my draft');
  await page.getByRole('tab',{name:'Changes',exact:true}).click();
  await page.getByRole('tab',{name:'Messages',exact:true}).click();
  await expect(page.getByLabel('Original visitor message')).toHaveValue('Keep my draft');
});
