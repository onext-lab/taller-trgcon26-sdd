import { expect, test, type Page } from '@playwright/test';

// Filtered list of jobs (HU-02, RF-05) against the real API and web, on a database regenerated at start
// (playwright.config.ts). The data that the flow does not test is prepared through the API. Every check of the
// list uses a filter (`status`, `q`): the totals without filters are not asserted (DD-09). No other spec uses
// «gestión» or «Oferta de paginación» in a title.

type JobStatus = 'draft' | 'published' | 'closed';

/** Creates a complete job through the API and takes it to the status; the actions are sent without a body. */
async function createJobByApi(page: Page, title: string, status: JobStatus): Promise<void> {
  const created = await page.request.post('/api/jobs', {
    data: {
      title,
      description: 'Oferta preparada para comprobar el listado.',
      location: 'Madrid',
      workMode: 'presencial',
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: number };
  if (status === 'draft') return;
  expect((await page.request.post(`/api/jobs/${id}/publish`)).ok()).toBe(true);
  if (status === 'closed')
    expect((await page.request.post(`/api/jobs/${id}/close`)).ok()).toBe(true);
}

function titlesInTable(page: Page) {
  return page.getByRole('table').getByRole('link');
}

async function applyFilters(page: Page, status: string, text: string): Promise<void> {
  await page.getByLabel('Estado').selectOption({ label: status });
  await page.getByLabel('Buscar por título').fill(text);
  await page.getByRole('button', { name: 'Buscar' }).click();
}

test('CA-16 filtrar por estado y título: solo las publicadas que contienen el texto, sin acentos ni mayúsculas', async ({
  page,
}) => {
  await createJobByApi(page, 'GESTIÓN de proveedores', 'published');
  await createJobByApi(page, 'Técnico/a de gestión administrativa', 'draft');
  await createJobByApi(page, 'Coordinador/a de gestión de eventos', 'closed');

  await page.goto('/jobs');
  await applyFilters(page, 'Publicada', 'gestion');

  await expect(titlesInTable(page)).toHaveText([
    'GESTIÓN de proveedores',
    'Responsable de gestión de nóminas',
  ]);
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/jobs' &&
      url.searchParams.get('status') === 'published' &&
      url.searchParams.get('q') === 'gestion',
  );
});

test('CA-18 paginar y cambiar el tamaño: 21 resultados, la URL conserva el filtro y «Atrás» restaura', async ({
  page,
}) => {
  for (let number = 1; number <= 21; number += 1) {
    await createJobByApi(
      page,
      `Oferta de paginación ${String(number).padStart(2, '0')}`,
      'published',
    );
  }

  await page.goto('/jobs');
  await applyFilters(page, 'Publicada', 'Oferta de paginación');
  await expect(page.getByText('Página 1 de 2 (21 ofertas)')).toBeVisible();
  await expect(titlesInTable(page)).toHaveCount(20);

  await page.getByRole('link', { name: 'Siguiente' }).click();
  await expect(page.getByText('Página 2 de 2 (21 ofertas)')).toBeVisible();
  await expect(titlesInTable(page)).toHaveText(['Oferta de paginación 01']);
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('status') === 'published' &&
      url.searchParams.get('q') === 'Oferta de paginación' &&
      url.searchParams.get('page') === '2',
  );

  await page.getByLabel('Por página').selectOption('50');
  await expect(page.getByText('Página 1 de 1 (21 ofertas)')).toBeVisible();
  await expect(titlesInTable(page)).toHaveCount(21);
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('status') === 'published' &&
      url.searchParams.get('pageSize') === '50' &&
      !url.searchParams.has('page'),
  );

  await page.goBack();
  await expect(page.getByText('Página 2 de 2 (21 ofertas)')).toBeVisible();
  await expect(titlesInTable(page)).toHaveCount(1);
  await expect(page.getByLabel('Por página')).toHaveValue('20');
  await expect(page.getByLabel('Estado')).toHaveValue('published');
  await expect(page.getByLabel('Buscar por título')).toHaveValue('Oferta de paginación');
});

test('EC-36 con la API caída al filtrar: alerta con «Reintentar» y los controles conservan lo elegido', async ({
  page,
}) => {
  await page.goto('/jobs');
  await expect(page.getByRole('table')).toBeVisible();
  await page.route(
    (url) => url.pathname === '/api/jobs' && url.search !== '',
    (route) => route.abort(),
  );

  await applyFilters(page, 'Publicada', 'nóminas');

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByLabel('Estado')).toHaveValue('published');
  await expect(page.getByLabel('Buscar por título')).toHaveValue('nóminas');
});

test('CA-19 una URL con pageSize=101: la alerta explica el error y «Quitar filtros» vuelve al listado', async ({
  page,
}) => {
  await page.goto('/jobs?pageSize=101');

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Quitar filtros' }).click();

  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
