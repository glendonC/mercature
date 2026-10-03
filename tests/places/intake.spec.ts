import { test, expect } from '@playwright/test';
import { validateBoundary } from '../../src/places/store';

test('geographic scope rejects reversed or nonfinite coordinates', () => {
  expect(() => validateBoundary({ west: 127, south: 37, east: 127.1, north: 37.1 })).not.toThrow();
  for (const bounds of [{ west: 2, south: 0, east: 1, north: 1 }, { west: 0, south: 90, east: 1, north: 91 }, { west: NaN, south: 0, east: 1, north: 1 }]) expect(() => validateBoundary(bounds)).toThrow();
});

test('a quiet local workspace saves details and original files across reopening', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Explore a place' }).fill('Test orchard');
  await page.getByRole('button', { name: /^Add your own photos/ }).click();
  await expect(page.getByRole('heading', { name: 'Show your place' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add photos or video', exact: true })).toBeEnabled();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByLabel('Area and measurement notes')).toBeHidden();
  await expect(page.getByLabel('West', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Place details' })).toBeVisible();
  await page.getByLabel('Area and measurement notes').fill('North gate needs an independent width check.');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.locator('.place-workspace input[type=file][multiple]').setInputFiles({ name: 'evidence.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBZkAAAAASUVORK5CYII=', 'base64') });
  await expect(page.locator('.place-notices').getByRole('status')).toContainText('saved on this device');
  await expect(page.getByRole('img', { name: 'evidence.png', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View evidence.png' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.getByRole('button', { name: 'Search places' }).click();
  await page.getByRole('button', { name: /Test orchard/ }).click();
  await expect(page.getByRole('img', { name: 'evidence.png', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.getByLabel('Area and measurement notes')).toHaveValue('North gate needs an independent width check.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Details', exact: true })).toBeFocused();
});

test('unsupported uploads preserve the clean invitation and show the real validation error', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Explore a place' }).fill('File validation place');
  await page.getByRole('button', { name: /^Add your own photos/ }).click();
  await page.locator('.place-workspace input[type=file][multiple]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') });
  await expect(page.getByRole('alert')).toContainText('Use JPEG, PNG, WebP, MP4, MOV or WebM files.');
  await expect(page.getByRole('heading', { name: 'Show your place' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add photos or video' })).toBeEnabled();
});
