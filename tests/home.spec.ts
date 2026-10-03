import { test, expect } from '@playwright/test';

test('an unlisted place starts only after choosing to add photos', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'An editable spatial accessibility model'})).toBeVisible();
  await page.getByRole('textbox', {name:'Explore a place'}).fill('My visitor garden');
  await page.getByRole('button', {name:'Search places',exact:true}).click();
  await expect(page.getByText('No prepared scene for “My visitor garden” yet.')).toBeVisible();
  await expect(page.getByRole('heading', {name:'My visitor garden',exact:true})).toHaveCount(0);
  await page.getByRole('button', {name:/^Add your own photos/}).click();
  await expect(page.getByRole('heading', {name:'My visitor garden',exact:true})).toBeVisible();
});

test('search finds the editing example without adding another background destination', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('button', {name:/^Explore .* · /})).toHaveCount(3);
  const search = page.getByRole('textbox', {name:'Explore a place'});
  await search.fill('Visitor courtyard');
  await expect(page.getByRole('button', {name:'Visitor courtyard · Authored editing demo'})).toBeVisible();
  await search.press('Enter');
  await expect(page.getByRole('button', {name:'Visitor courtyard · Authored editing demo'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(search).toBeFocused();
  await expect(page.locator('#place-results')).toBeHidden();
  await search.press('Enter');
  await page.getByRole('button', {name:'Visitor courtyard · Authored editing demo'}).click();
  await page.getByRole('button', {name:'Skip walkthrough',exact:true}).click();
  await expect(page.getByRole('button', {name:'Check the passage →'})).toBeVisible();
});

test('home upload saves original photos directly and lets the operator name the place', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Upload photos or a saved plan'}).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', {name:/^Photos or video/}).click();
  await (await chooser).setFiles({name:'entrance.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBZkAAAAASUVORK5CYII=','base64')});
  await expect(page.getByRole('img', {name:'entrance.png',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Details',exact:true}).click();
  await page.getByLabel('Place name', {exact:true}).fill('North entrance');
  await page.getByRole('button', {name:'Save details',exact:true}).click();
  await page.reload();
  await page.getByRole('textbox', {name:'Explore a place'}).fill('North entrance');
  await expect(page.getByText('On this device', {exact:true})).toBeVisible();
  await page.getByRole('button', {name:'North entrance Photos & notes',exact:true}).click();
  await expect(page.getByRole('img', {name:'entrance.png',exact:true})).toBeVisible();
});

test('failed home import shows an accessible error outside the dismissed upload dialog', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Upload photos or a saved plan'}).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', {name:/^Saved Mercature plan/}).click();
  await (await chooser).setFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await expect(page.getByRole('dialog', {name:'Add to Mercature'})).toBeHidden();
  await expect(page.getByRole('alert')).toContainText('Could not open this file');
});

for (const size of [{width:1280,height:720},{width:390,height:844}]) {
  test(`home destination and split input controls fit at ${size.width} pixels`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const input = await page.getByRole('textbox', {name:'Explore a place'}).boundingBox();
    const upload = await page.getByRole('button', {name:'Upload photos or a saved plan'}).boundingBox();
    const submit = await page.getByRole('button', {name:'Search places'}).boundingBox();
    expect(upload!.x + upload!.width).toBeLessThan(input!.x);
    expect(input!.x + input!.width).toBeLessThan(submit!.x);
    expect(submit!.x + submit!.width).toBeLessThanOrEqual(size.width);
    await page.screenshot({path:`.local/home-${size.width}.png`});
    await page.getByRole('textbox', {name:'Explore a place'}).fill('Narikala');
    await expect(page.getByRole('button', {name:'Narikala Tbilisi',exact:true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  });
}
