import {test, expect, type Page} from '@playwright/test';

// Invented contract record exercising a photo-only place without redistributing captures.
const photoOnly = {schema:'mercature-route/1',id:'kathmandu-swayambhu',synthetic:false,local_only:true,title:'Test source',place:'Test record',
  route:{frame:{axes:'east-north-up',origin:[0,0,0]},line:[[0,0],[.001,.001]]},request:{destination:{name:'Target',position:[.001,.001]}},
  photos:[{id:'p1',position:[0,0],heading:0,captured_at:null,creator:{username:'Fixture'},licence:'Fixture only',link:null,file:null,thumb:null}],
  views:[{id:'v1',photo_id:'p1',file:'views/v1.jpg',width:2,height:2,cut:null}],spots:[],findings:[],sources:[],map_context:{buildings:{features:[]},ways:{features:[]}}};

/** Every line the replay says, in order, kept as it happens: a step's line shows for under a second, shorter than a polling gap. */
async function listen(page: Page) {
  await page.evaluate(() => {
    const said: string[] = [];
    (window as unknown as { said: string[] }).said = said;
    new MutationObserver(() => { const line = document.querySelector('.reveal-say')?.textContent?.trim(); if (line && said.at(-1) !== line) said.push(line); })
      .observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  return () => page.evaluate(() => (window as unknown as { said: string[] }).said);
}

test('the Qorikancha reveal replays how the walk was built and opens the inspection on the same map', async ({page}) => {
  test.setTimeout(25000);
  await page.route('**/routes/**', route => route.fulfill({status:404, body:'Prepared files are not installed on this device.'}));
  await page.goto('/');
  const said = await listen(page);
  await page.getByRole('button', {name:'Explore Qorikancha · Cusco', exact:true}).click();
  const reveal = page.getByRole('region', {name:'Qorikancha', exact:true});
  await expect(reveal.getByRole('heading', {name:'Qorikancha'})).toBeVisible();
  // A few photos are read on the map, one after another, before the findings arrive.
  await expect(reveal).toHaveAttribute('data-step', 'reading', {timeout: 10000});
  await expect(reveal.getByRole('figure').first()).toBeVisible();
  await expect(reveal).toHaveAttribute('data-step', 'barriers', {timeout: 10000});
  // The counts sit in small figures under the place's name, each as it is placed.
  await expect(reveal.getByRole('img', {name: /^\d+ street photos of this route$/})).toBeVisible();
  // Every mark the package records, not only those whose photos are published.
  await expect(reveal.getByRole('img', {name: '5 spots to check'})).toBeVisible();
  await expect(reveal.getByRole('img', {name: /marks along the route|might be barriers/})).toHaveCount(0);
  // The guide speaks in plain words: it never counts photos or marks, and never says how the tour route was built.
  const lines = await said();
  expect(lines.length).toBeGreaterThan(2);
  expect(lines.some(line => /\d+ (street photos|marks)/.test(line))).toBe(false);
  await expect(reveal).not.toContainText(/recorded|unverified|outlined|GPU/i);
  // A short replay may already be handing off on its own; Skip only works while it plays. Either way it lands on the canvas map.
  const skip = page.getByRole('button', {name:'Skip', exact:true});
  await skip.click({timeout: 1000}).catch(() => {});
  await expect(reveal).toBeHidden({timeout: 10000});
  await expect(page.getByRole('heading', {name:'Qorikancha', exact:true})).toBeVisible();
  await expect(page.getByRole('region', {name:'Geographic source map'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Check the passage'})).toHaveCount(0);
});

test('a photo-only place replays its photo and still opens its map', async ({page}) => {
  test.setTimeout(20000);
  await page.route('**/routes/**/route.json', route => route.fulfill({json: photoOnly}));
  await page.route('**/routes/**/views/*.jpg', route => route.fulfill({status:404}));
  await page.goto('/');
  await page.getByRole('button', {name:'Explore Swayambhu · Kathmandu'}).click();
  const reveal = page.getByRole('region', {name:'Swayambhu', exact:true});
  await expect(reveal.getByRole('img', {name: '1 street photo of this route'})).toBeVisible({timeout: 8000});
  await page.keyboard.press('Escape');
  await expect(reveal).toBeHidden();
  await page.getByRole('button', {name:'3D', exact:true}).click();
  await expect(page.getByText('No retained 3D at this destination')).toBeVisible();
});

test('a place with neither a published package nor its records is not offered on Home', async ({page}) => {
  await page.route('**/routes/**', route => route.fulfill({status:404, body:'Prepared files are not installed on this device.'}));
  await page.goto('/');
  await expect(page.getByRole('button', {name:'Explore Qorikancha · Cusco'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Explore Narikala · Tbilisi'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Explore Swayambhu · Kathmandu'})).toHaveCount(0);
});
