import { expect, test } from '@playwright/test';

// The entry of the web is the job list; the API health stays in the footer (DD-07). There are two
// `role="status"` on the page, so the health line is found by its text.
test('la entrada es el listado de ofertas y muestra el estado de la API', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole('heading', { name: 'Ofertas' })).toBeVisible();
  await expect(page.getByText('Estado de la API: ok')).toBeVisible();
});
