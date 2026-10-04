import { test, expect } from '@playwright/test';

test('home offers the prepared walk itself, with no search box and nothing to upload', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'An editable spatial accessibility model'})).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', {name:/upload/i})).toHaveCount(0);
  const walk = page.getByRole('button', {name:'Explore Qorikancha · Cusco', exact:true});
  await expect(walk).toContainText('594 m on foot');
  await expect(walk).toContainText('5 spots to check');
  await walk.click();
  await expect(page.getByRole('region', {name:'Qorikancha', exact:true})).toBeVisible();
});

test('the farm card is marked an example and its getting-ready steps hand the farm to the workspace', async ({page}) => {
  test.setTimeout(20000);
  await page.goto('/');
  const farm = page.getByRole('button', {name:/^Noor's farm/});
  await expect(farm).toHaveAccessibleName(/Example$/);
  await farm.click();
  await expect(page.locator('li[data-step=paths]')).toContainText('3 of 4 reachable');
  await expect(page.locator('li[data-step=model]')).toContainText(/Ready|Loading|Use without AI/);
  await expect(page.getByRole('status').filter({hasText:"Noor's farm is ready."})).toBeVisible();
  await expect(page.locator('.farm-ready')).toHaveCount(0, {timeout: 8000});
  await expect(page.getByRole('button', {name:'View options', exact:true})).toBeVisible();
});

for (const size of [{width:1280,height:720},{width:390,height:844}]) {
  test(`the walk and the places it offers fit at ${size.width} pixels`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.locator('.route-map .map-route-line')).toBeVisible();
    const places = await page.getByRole('button', {name:'Explore Qorikancha · Cusco'}).boundingBox();
    const words = await page.locator('.home-words h1').boundingBox();
    expect(places!.y + places!.height).toBeLessThanOrEqual(size.height);
    expect(words!.y + words!.height).toBeLessThan(places!.y);
    await page.screenshot({path:`.local/home-${size.width}.png`});
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  });
}

test('the install manifest uses relative paths and every icon it names is served', async ({page, request}) => {
  await page.goto('/');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(href).toBe('./manifest.webmanifest');
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({name:'Mercature', start_url:'./', scope:'./', display:'standalone'});
  expect(manifest.icons.map((icon: {purpose: string}) => icon.purpose)).toContain('maskable');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);
});
