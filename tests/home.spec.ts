import { test, expect } from '@playwright/test';

test('home offers the prepared walk itself, and nothing to upload', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'An editable spatial accessibility model'})).toBeVisible();
  await expect(page.getByRole('button', {name:/upload/i})).toHaveCount(0);
  // Only places with a prepared model are offered; the farm example is not one of them.
  await expect(page.getByRole('button', {name:/Noor/})).toHaveCount(0);
  const walk = page.getByRole('button', {name:'Explore Qorikancha · Cusco', exact:true});
  // A card says only where the place is.
  await expect(walk).toContainText('Cusco');
  await expect(walk).not.toContainText('594 m');
  await walk.click();
  await expect(page.getByRole('region', {name:'Qorikancha', exact:true})).toBeVisible();
});

/** Encodes [lon, lat] points as a Valhalla shape (polyline at six decimals). */
function shape(points: [number, number][]) {
  let out = '', lat = 0, lon = 0;
  const put = (value: number) => { let v = value < 0 ? ~(value << 1) : value << 1; while (v >= 0x20) { out += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } out += String.fromCharCode(v + 63); };
  for (const [x, y] of points) { const a = Math.round(y * 1e6), b = Math.round(x * 1e6); put(a - lat); put(b - lon); lat = a; lon = b; }
  return out;
}

test('search filters prepared places as she types, and one clear answer builds a map-only walk at once', async ({page}) => {
  const asked: string[] = [];
  const museum: [number, number] = [-77.0370039, -12.0604622], square: [number, number] = [-77.0346048, -12.0566596];
  await page.route('https://nominatim.openstreetmap.org/**', route => {
    asked.push(route.request().url());
    return route.fulfill({ json: [{ osm_type: 'way', osm_id: 40301549, lat: String(museum[1]), lon: String(museum[0]), type: 'museum', addresstype: 'tourism', place_rank: 30, boundingbox: ['-12.0610', '-12.0600', '-77.0375', '-77.0365'],
      name: 'Museo de Arte de Lima', display_name: 'Museo de Arte de Lima, Avenida 9 de Diciembre, Lima, Peru', namedetails: { name: 'Museo de Arte de Lima' }, address: { city: 'Lima', country: 'Peru' } }] });
  });
  await page.route('https://overpass-api.de/**', route => {
    const query = decodeURIComponent(route.request().postData() ?? '');
    // The start: a square about 450 m away. Along the walk: one flight of steps.
    if (query.includes('place=square')) return route.fulfill({ json: { elements: [{ type: 'node', id: 1, lat: square[1], lon: square[0], tags: { place: 'square', name: 'Plaza Prueba' } }] } });
    return route.fulfill({ json: { elements: [{ type: 'way', id: 2, tags: { highway: 'steps' }, geometry: [{ lat: -12.0580, lon: -77.0360 }, { lat: -12.05804, lon: -77.03602 }] }] } });
  });
  await page.route('https://valhalla1.openstreetmap.de/**', route => route.fulfill({ json: { trip: { legs: [{ shape: shape([square, [-77.0360, -12.0580], museum]), maneuvers: [{ street_names: ['Jirón Prueba'], begin_shape_index: 0, end_shape_index: 2 }] }] } } }));
  await page.goto('/');
  await expect(page.getByText('Search asks OpenStreetMap online.')).toHaveCount(0);
  const field = page.getByRole('textbox', {name:'Search a place'});
  await field.fill('Qorikanca');
  await expect(page.locator('.home-search-panel').getByRole('button', {name:/Qorikancha/})).toContainText('With street photos');
  expect(asked).toHaveLength(0);
  await field.fill('Museo de Arte de Lima');
  await field.press('Enter');
  await expect(page.locator('.guide-screen')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.gs-place')).toContainText('Plaza Prueba, 507 m on foot');
  await expect(page.locator('.guide-screen .ui-dialogue')).toContainText(/about 500 m/i, { timeout: 8000 });
  expect(asked).toHaveLength(1);
  // Back on Home the walk is no card: it waits under Recent while the empty field has focus, and can be removed.
  await page.goBack();
  await expect(page.locator('.home-saved')).toHaveCount(0);
  // Home first offers this walk another start; Escape leaves that, and the empty field shows Recent.
  await expect(page.getByRole('textbox', {name:'Where does the route start?'})).toBeVisible();
  await field.focus();
  await page.keyboard.press('Escape');
  await field.focus();
  const recent = page.locator('.home-search-recent li', { hasText: 'Museo de Arte de Lima' });
  await expect(recent).toBeVisible();
  await recent.getByRole('button', { name: 'Remove Museo de Arte de Lima from this device' }).click();
  await expect(page.locator('.home-search-recent')).toHaveCount(0);
});

test('a whole city asks for a landmark, and offline offers the prepared walks', async ({page, context}) => {
  await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [{ osm_type: 'relation', osm_id: 1944670, lat: '-12.06', lon: '-77.04', type: 'administrative', addresstype: 'city', place_rank: 16,
    boundingbox: ['-12.3', '-11.7', '-77.2', '-76.8'], name: 'Lima', display_name: 'Lima, Peru', namedetails: { name: 'Lima' }, address: { country: 'Peru' } }] }));
  await page.goto('/');
  const field = page.getByRole('textbox', {name:'Search a place'});
  await field.fill('Lima');
  await field.press('Enter');
  await expect(page.locator('.home-guide')).toContainText('Lima is a big area. Try a landmark or a street in it.');
  await context.setOffline(true);
  await field.fill('Chinchero');
  await field.press('Enter');
  await expect(page.locator('.home-guide')).toContainText('Search needs internet. Your prepared walks still open.');
  await expect(page.locator('.home-search-panel').getByRole('button', {name:/Qorikancha/})).toBeVisible();
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
    await expect(page.locator('.route-canvas')).toBeVisible();
  };
  await open();
  await page.goBack();
  await expect(home).toBeVisible();
  await expect(page.locator('.reveal')).toHaveCount(0);
  await open();
  await page.locator('.route-canvas .menu-button').click();
  await page.getByRole('button', {name:'Home', exact:true}).click();
  await expect(home).toBeVisible();
  // Home is the first entry again, so the next Back leaves the app instead of returning to the place.
  expect(await page.evaluate(() => history.state)).toBeNull();
});
