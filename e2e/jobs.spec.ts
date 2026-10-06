import { expect, test, type Page } from '@playwright/test';

// Flows of HU-01 against the real API and web, on a database regenerated at start (playwright.config.ts).
// Each test that writes creates its own jobs with a fixed title that no other test (nor the seed) uses, so
// the tests do not depend on each other. Other tests (and the lifecycle and list specs, which run first) create
// newer jobs: never check absolute positions, and check the list with a filter or `pageSize=100` (DD-09).

const SEED_TITLES = [
  // Order of the list (most recent first); update together with apps/api/src/db/seed.ts.
  { title: 'Desarrollador/a frontend (React)', date: '01/10/2026' },
  { title: 'Diseñador/a de producto', date: '28/09/2026' },
  { title: 'Técnico/a de soporte IT', date: '24/09/2026' },
  { title: 'Analista de datos junior', date: '21/09/2026' },
];

type NewJob = {
  title: string;
  description?: string;
  location?: string;
  workMode?: string;
  salaryMin?: string;
  salaryMax?: string;
};

/** Creates a job through the form and leaves the page on its detail; returns its ID. */
async function createJob(page: Page, job: NewJob): Promise<number> {
  await page.goto('/jobs/new');
  await page.getByLabel('Título (obligatorio)').fill(job.title);
  if (job.description) await page.getByLabel('Descripción').fill(job.description);
  if (job.location) await page.getByLabel('Ubicación').fill(job.location);
  if (job.workMode) await page.getByLabel('Modalidad').selectOption({ label: job.workMode });
  if (job.salaryMin) await page.getByLabel('Salario mínimo (€/año)').fill(job.salaryMin);
  if (job.salaryMax) await page.getByLabel('Salario máximo (€/año)').fill(job.salaryMax);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/\/jobs\/\d+$/);
  const id = Number(new URL(page.url()).pathname.split('/').pop());
  expect(Number.isInteger(id)).toBe(true);
  return id;
}

/** The `<dd>` that follows the `<dt>` with that label in the detail. */
function detailValue(page: Page, term: string) {
  return page.locator('dt', { hasText: term }).locator('+ dd');
}

function listLink(page: Page, title: string) {
  return page.getByRole('link', { name: title, exact: true });
}

function mainNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Principal' });
}

test('RF-05/RF-07 el listado muestra los borradores del seed en su orden, con estado y fecha', async ({
  page,
}) => {
  await page.goto('/jobs?status=draft&pageSize=100');
  await expect(page.getByRole('table')).toBeVisible();

  const shown = await page.getByRole('table').getByRole('link').allTextContents();
  const seedShown = shown.filter((title) => SEED_TITLES.some((seed) => seed.title === title));
  expect(seedShown).toEqual(SEED_TITLES.map((seed) => seed.title));

  for (const seed of SEED_TITLES) {
    const row = page
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name: seed.title, exact: true }) });
    await expect(row.getByRole('cell', { name: 'Borrador' })).toBeVisible();
    await expect(row.getByRole('cell', { name: seed.date })).toBeVisible();
  }
});

test('CA-01 alta solo con título: ficha con aviso y aparece en el listado', async ({ page }) => {
  const title = 'Responsable de nóminas';
  await page.goto('/jobs');
  await page.getByRole('link', { name: 'Nueva oferta' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva oferta' })).toBeVisible();

  await page.getByLabel('Título (obligatorio)').fill(title);
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText('Oferta creada.')).toBeVisible();
  await expect(detailValue(page, 'Estado')).toHaveText('Borrador');

  await mainNavigation(page).getByRole('link', { name: 'Ofertas' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ofertas' })).toBeVisible();
  await page.goto('/jobs?pageSize=100');
  await expect(listLink(page, title).first()).toBeVisible();
});

test('CA-02/EC-03 alta completa: la ficha muestra todo y el título se guarda sin espacios sobrantes', async ({
  page,
}) => {
  const id = await createJob(page, {
    title: '  Técnica/o de selección  ',
    description: 'Gestiona procesos de selección de principio a fin.',
    location: 'Valencia',
    workMode: 'Híbrida',
    salaryMin: '32000',
    salaryMax: '40000',
  });

  await expect(
    page.getByRole('heading', { level: 1, name: 'Técnica/o de selección' }),
  ).toBeVisible();
  await expect(detailValue(page, 'Descripción')).toHaveText(
    'Gestiona procesos de selección de principio a fin.',
  );
  await expect(detailValue(page, 'Ubicación')).toHaveText('Valencia');
  await expect(detailValue(page, 'Modalidad')).toHaveText('Híbrida');
  await expect(detailValue(page, 'Banda salarial')).toHaveText('32.000 – 40.000 €/año');

  // The accessible name collapses whitespace: the stored title is read from the API.
  const response = await page.request.get(`/api/jobs/${id}`);
  expect((await response.json()).title).toBe('Técnica/o de selección');
});

test('CA-03 título de 2 caracteres: error junto al campo y se sigue en el formulario', async ({
  page,
}) => {
  await page.goto('/jobs/new');
  await page.getByLabel('Título (obligatorio)').fill('ab');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByText('El título debe tener entre 3 y 120 caracteres.')).toBeVisible();
  await expect(page.getByLabel('Título (obligatorio)')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Nueva oferta' })).toBeVisible();
  await expect(page).toHaveURL(/\/jobs\/new$/);
});

test('CA-09/CA-10/EC-21 editar un borrador y vaciar un campo opcional', async ({ page }) => {
  await createJob(page, { title: 'Coordinador/a de formación' });

  await page.getByRole('link', { name: 'Editar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Editar oferta' })).toBeVisible();
  await page.getByLabel('Descripción').fill('Diseña el plan anual de formación interna.');
  await page.getByLabel('Ubicación').fill('Zaragoza');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByText('Cambios guardados.')).toBeVisible();
  await expect(detailValue(page, 'Descripción')).toHaveText(
    'Diseña el plan anual de formación interna.',
  );
  await expect(detailValue(page, 'Ubicación')).toHaveText('Zaragoza');

  await page.getByRole('link', { name: 'Editar' }).click();
  await expect(page.getByLabel('Descripción')).toHaveValue(
    'Diseña el plan anual de formación interna.',
  );
  await page.getByLabel('Descripción').fill('');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Coordinador/a de formación' }),
  ).toBeVisible();
  await expect(detailValue(page, 'Descripción')).toHaveText('Sin indicar');
  await expect(detailValue(page, 'Ubicación')).toHaveText('Zaragoza');
});

test('CA-11/EC-23 dos páginas editan el mismo borrador: gana la última en guardar', async ({
  context,
  page,
}) => {
  const id = await createJob(page, { title: 'Especialista en compensación' });
  const first = await context.newPage();
  const second = await context.newPage();
  for (const editor of [first, second]) {
    await editor.goto(`/jobs/${id}/edit`);
    await expect(editor.getByLabel('Ubicación')).toBeVisible();
  }

  await first.getByLabel('Ubicación').fill('Sevilla');
  await first.getByRole('button', { name: 'Guardar' }).click();
  await expect(detailValue(first, 'Ubicación')).toHaveText('Sevilla');

  await second.getByLabel('Ubicación').fill('Bilbao');
  await second.getByRole('button', { name: 'Guardar' }).click();
  await expect(detailValue(second, 'Ubicación')).toHaveText('Bilbao');

  await first.goto(`/jobs/${id}`);
  await expect(detailValue(first, 'Ubicación')).toHaveText('Bilbao');
});

test('CA-13 borrar pide confirmación: Escape cancela y confirmar borra', async ({ page }) => {
  const title = 'Auxiliar administrativo/a';
  const draftsView = '/jobs?status=draft&pageSize=100';
  const id = await createJob(page, { title });

  // The job is in this view before deleting, so its absence afterwards means something.
  await page.goto(draftsView);
  await expect(listLink(page, title)).toHaveCount(1);
  await page.goto(`/jobs/${id}`);

  await page.getByRole('button', { name: 'Borrar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

  await page.getByRole('button', { name: 'Borrar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Borrar oferta' }).click();

  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByText('Oferta borrada.')).toBeVisible();
  await page.goto(draftsView);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(listLink(page, title)).toHaveCount(0);
});

test('CA-18/EC-38 con la API caída el listado avisa y permite reintentar', async ({ page }) => {
  await page.route('**/api/jobs', (route) => route.abort());
  await page.goto('/jobs');

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('CA-19 el HTML del título se muestra como texto literal', async ({ page }) => {
  const title = 'Oferta <b>X</b>';
  await createJob(page, { title });

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.locator('h1 b')).toHaveCount(0);
});

test('CA-20 una oferta inexistente muestra «Oferta no encontrada» y ninguna acción', async ({
  page,
}) => {
  await page.goto('/jobs/999999999');

  await expect(page.getByRole('heading', { level: 1, name: 'Oferta no encontrada' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Borrar' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Volver a las ofertas' })).toBeVisible();
});

test('EC-08 un título con SQL se guarda y se ve literal; el listado sigue cargando', async ({
  page,
}) => {
  const title = "'); DROP TABLE job_openings; --";
  await createJob(page, { title });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);

  await page.goto('/jobs?pageSize=100');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(listLink(page, title).first()).toBeVisible();
  await expect(listLink(page, 'Analista de datos junior')).toBeVisible();
});
