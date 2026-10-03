import { expect, test } from '@playwright/test';

test('Spanish changes the Home text and stays after a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Explore a place' })).toBeVisible();
  await page.getByRole('button', { name: 'Español' }).click();
  await expect(page.getByRole('textbox', { name: 'Explora un lugar' })).toHaveAttribute('placeholder', 'Explora un lugar');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('modelo de accesibilidad');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Explora un lugar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true');
});
