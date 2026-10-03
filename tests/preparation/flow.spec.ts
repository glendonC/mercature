import {test, expect} from '@playwright/test';

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('textbox', {name:'Explore a place'}).fill('Visitor courtyard');
  await page.getByRole('button', {name:'Visitor courtyard · Authored editing demo'}).click();
}
