import {test, expect} from '@playwright/test';

// Invented contract record exercising a photo-only place without redistributing captures.
const photoOnly = {schema:'mercature-route/1',id:'kathmandu-swayambhu',synthetic:false,local_only:true,title:'Test source',place:'Test record',
  route:{frame:{axes:'east-north-up',origin:[0,0,0]},line:[[0,0],[.001,.001]]},request:{destination:{name:'Target',position:[.001,.001]}},
  photos:[{id:'p1',position:[0,0],heading:0,captured_at:null,creator:{username:'Fixture'},licence:'Fixture only',link:null,file:null,thumb:null}],
  views:[{id:'v1',photo_id:'p1',file:'views/v1.jpg',width:2,height:2,cut:null}],spots:[],findings:[],sources:[],map_context:{buildings:{features:[]},ways:{features:[]}}};

test('the Qorikancha reveal replays the published records and opens the inspection on the same map', async ({page}) => {
  test.setTimeout(25000);
  await page.route('**/routes/**', route => route.fulfill({status:404, body:'Prepared files are not installed on this device.'}));
  await page.goto('/');
  await page.getByRole('textbox', {name:'Explore a place'}).fill('Plaza de Armas');
  await page.locator('#place-results button').first().click();
  const reveal = page.getByRole('region', {name:'Qorikancha, recorded preparation'});
  await expect(reveal.getByRole('heading', {name:'Qorikancha'})).toBeVisible();
  await expect(reveal).toContainText('Plaza de Armas to the ticket booth · 594 m');
  await expect(reveal).toContainText(/\d+ of 403 photos/);
  await expect(reveal.getByText('Model suggestion, unverified').first()).toBeVisible({timeout: 10000});
  await page.getByRole('button', {name:'Skip', exact:true}).click();
  await expect(reveal).toBeHidden();
  await expect(page.getByRole('heading', {name:'Qorikancha', exact:true})).toBeVisible();
  await expect(page.getByRole('region', {name:'Geographic source map'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Check the passage'})).toHaveCount(0);
});

test('a photo-only place says it has no 3D and still opens its map', async ({page}) => {
  test.setTimeout(20000);
  await page.route('**/routes/**/route.json', route => route.fulfill({json: photoOnly}));
  await page.route('**/routes/**/views/*.jpg', route => route.fulfill({status:404}));
  await page.goto('/');
  await page.getByRole('button', {name:'Explore Swayambhu · Kathmandu'}).click();
  const reveal = page.getByRole('region', {name:'Swayambhu, recorded preparation'});
  await expect(reveal).toContainText('No 3D here', {timeout: 8000});
  await page.keyboard.press('Escape');
  await expect(reveal).toBeHidden();
  await page.getByRole('button', {name:'3D', exact:true}).click();
  await expect(page.getByText('No retained 3D at this destination')).toBeVisible();
});

test('a recorded place without its records shows a calm preview that leads to a place that plays anywhere', async ({page}) => {
  test.setTimeout(20000);
  await page.route('**/routes/**', route => route.fulfill({status:404, body:'Prepared files are not installed on this device.'}));
  await page.goto('/');
  await page.getByRole('button', {name:'Explore Narikala · Tbilisi'}).click();
  const preview = page.getByRole('main', {name:'Narikala, recorded example'});
  await expect(preview).toContainText('Recorded example, available in a local install.');
  await expect(preview.getByRole('link', {name:'CC BY 2.0'})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await preview.getByRole('button', {name:'See Qorikancha'}).click();
  await expect(page.getByRole('region', {name:'Qorikancha, recorded preparation'})).toBeVisible();
});
