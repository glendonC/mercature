import { expect, test } from '@playwright/test';

test('Spanish changes the Home text and stays after a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('editable spatial');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Español' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('modelo de accesibilidad');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('modelo de accesibilidad');
  await page.locator('.menu-button').click();
  await expect(page.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true');
});
