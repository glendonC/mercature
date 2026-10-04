import { test, expect } from '@playwright/test';

test('home offers the prepared walk itself, and nothing to upload', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'An editable spatial accessibility model'})).toBeVisible();
  await expect(page.getByRole('button', {name:/upload/i})).toHaveCount(0);
  // Only places with a prepared model are offered; the farm example is not one of them.
  await expect(page.getByRole('button', {name:/Noor/})).toHaveCount(0);
  const walk = page.getByRole('button', {name:'Explore Qorikancha · Cusco', exact:true});
  await expect(walk).toContainText('594 m');
  await expect(walk).toContainText('5 flagged spots');
  await walk.click();
  await expect(page.getByRole('region', {name:'Qorikancha', exact:true})).toBeVisible();
});

test('search filters prepared places as she types and asks OpenStreetMap once, only when asked', async ({page}) => {
  const asked: string[] = [];
  await page.route('https://nominatim.openstreetmap.org/**', route => {
    asked.push(route.request().url());
    return route.fulfill({ json: [{ osm_type: 'way', osm_id: 40301549, lat: '-12.0604622', lon: '-77.0370039', type: 'museum', name: 'Museo de Arte de Lima',
      display_name: 'Museo de Arte de Lima, Avenida 9 de Diciembre, Lima, Peru', namedetails: { name: 'Museo de Arte de Lima' }, address: { city: 'Lima', country: 'Peru' } }] });
  });
  await page.goto('/');
  await expect(page.getByText('Search asks OpenStreetMap online.')).toBeVisible();
  const field = page.getByRole('textbox', {name:'Search a place'});
  await field.fill('coricancha');
  await expect(page.locator('.home-search-panel').getByRole('button', {name:/Qorikancha/})).toContainText('Street photos read');
  expect(asked).toHaveLength(0);
  await field.fill('Museo de Arte de Lima');
  await field.press('Enter');
  await expect(page.locator('.home-search-panel').getByRole('button', {name:/Museo de Arte de Lima/})).toContainText('Map only · Lima, Peru');
  await field.press('Enter');
  expect(asked).toHaveLength(1);
  await page.locator('.home-search-panel').getByRole('button', {name:/Museo de Arte de Lima/}).click();
  await expect(page.locator('.home-search-panel')).toContainText('Map only. No street photos read yet.');
  await expect(page.getByRole('textbox', {name:'Where does the walk start?'})).toBeFocused();
});

test('search offline says so in one plain line', async ({page, context}) => {
  await page.goto('/');
  await context.setOffline(true);
  const field = page.getByRole('textbox', {name:'Search a place'});
  await field.fill('Chinchero');
  await field.press('Enter');
  await expect(page.locator('.home-search-panel [role=alert]')).toHaveText('You are offline. Places on this device still open.');
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

test('Back from a place returns Home without replaying it, and the menu\'s Home steps back the same way', async ({page}) => {
  test.setTimeout(20000);
  await page.goto('/');
  const home = page.getByRole('heading', {name:'An editable spatial accessibility model'});
  const open = async () => {
    await page.getByRole('button', {name:'Explore Qorikancha · Cusco', exact:true}).click();
    await page.getByRole('button', {name:'Skip', exact:true}).click();
    await expect(page.locator('.route-inbox')).toBeVisible();
  };
  await open();
  await page.goBack();
  await expect(home).toBeVisible();
  await expect(page.locator('.reveal')).toHaveCount(0);
  await open();
  await page.locator('.route-inbox .menu-button').click();
  await page.getByRole('button', {name:'Home', exact:true}).click();
  await expect(home).toBeVisible();
  // Home is the first entry again, so the next Back leaves the app instead of returning to the place.
  expect(await page.evaluate(() => history.state)).toBeNull();
});
