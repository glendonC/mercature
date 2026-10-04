import { test, expect } from '@playwright/test';

test('home offers the prepared walk itself, with no search box and nothing to upload', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'An editable spatial accessibility model'})).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', {name:/upload/i})).toHaveCount(0);
  // Only places with a prepared model are offered; the farm example is not one of them.
  await expect(page.getByRole('button', {name:/Noor/})).toHaveCount(0);
  const walk = page.getByRole('button', {name:'Explore Qorikancha · Cusco', exact:true});
  await expect(walk).toContainText('594 m');
  await expect(walk).toContainText('5 flagged spots');
  await walk.click();
  await expect(page.getByRole('region', {name:'Qorikancha', exact:true})).toBeVisible();
});

for (const size of [{width:1280,height:720},{width:390,height:844}]) {
  test(`the walk and the places it offers fit at ${size.width} pixels`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.locator('.route-map .map-route-line')).toBeVisible();
    await expect(page.locator('.home-credit')).toBeVisible();
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
