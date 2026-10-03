import {test, expect} from '@playwright/test';

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('textbox', {name:'Explore a place'}).fill('Visitor courtyard');
  await page.getByRole('button', {name:'Visitor courtyard · Authored editing demo'}).click();
}
for (const size of [{width:1280,height:720},{width:390,height:844}]) {
  test(`preparation opens the same editable scene and fits at ${size.width} pixels`, async ({page}) => {
    await page.setViewportSize(size);
    await open(page);
    await expect(page.getByRole('heading', {name:'Start with the layout.'})).toBeVisible();
    await expect(page.getByText('Authored dimensions · no captured photographs')).toBeVisible();
    const action = await page.getByRole('button', {name:'Load scene',exact:true}).boundingBox();
    expect(action!.y + action!.height).toBeLessThanOrEqual(size.height);
    await page.screenshot({path:`.local/preparation-layout-${size.width}.png`});
    await page.getByRole('button', {name:'Load scene',exact:true}).click();
    await expect(page.getByRole('heading', {name:'Your scene is ready.'})).toBeVisible();
    await expect(page.getByRole('region', {name:'Spatial model',exact:true})).toBeVisible();
    await page.screenshot({path:`.local/preparation-scene-${size.width}.png`});
    await page.getByRole('button', {name:'Enter scene',exact:true}).click();
    await expect(page.getByRole('button', {name:'Check the passage'})).toBeVisible();
    await page.getByRole('button', {name:'Check the passage'}).click();
    await page.getByRole('button', {name:'Yes, this feature'}).click();
    await page.getByRole('button', {name:'Remove bench',exact:true}).click();
    await expect(page.locator('.compact-comparison')).toContainText('Connected');
    await page.getByRole('button', {name:'Save improvement plan'}).click();
    await expect(page.getByRole('heading', {name:'Plan saved.'})).toBeVisible();
  });
}
test('skipping preparation opens the workspace and returning preserves the in-progress edit', async ({page}) => {
  await open(page);
  await page.getByRole('button', {name:'Scene options',exact:true}).click();
  await page.getByRole('button', {name:'Skip walkthrough',exact:true}).click();
  await page.getByRole('button', {name:'Check the passage'}).click();
  await page.getByRole('button', {name:'Yes, this feature'}).click();
  await page.getByRole('button', {name:'Remove bench',exact:true}).click();
  await page.getByRole('button', {name:'Scene options',exact:true}).click();
  await page.getByRole('button', {name:'Home',exact:true}).click();
  await page.getByRole('textbox', {name:'Explore a place'}).fill('Visitor courtyard');
  await page.getByRole('button', {name:'Visitor courtyard · Authored editing demo'}).click();
  await expect(page.getByRole('button', {name:'Save improvement plan'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Load scene',exact:true})).toHaveCount(0);
});

test('entering the authored workspace preserves the preview rotation and selected feature', async ({page}) => {
  await open(page);
  await page.getByRole('button', {name:'Load scene',exact:true}).click();
  await page.getByRole('button', {name:'Scene options',exact:true}).click();
  await page.getByRole('button', {name:'Rotate 3D view',exact:true}).click();
  await page.getByRole('button', {name:'Inspect North dividing wall',exact:true}).click();
  const projection = page.getByRole('group', {name:'3D of synthetic courtyard'}).locator('polygon').first();
  const points = await projection.getAttribute('points');
  await page.getByRole('button', {name:'Enter scene',exact:true}).click();
  await expect(projection).toHaveAttribute('points',points!);
  await expect(page.getByRole('button', {name:'Inspect North dividing wall',exact:true})).toHaveAttribute('aria-pressed','true');
});
