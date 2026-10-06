import { expect, test } from '@playwright/test';

test('la página carga y muestra el estado de la API', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'ATS' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Estado de la API: ok');
});
