import { expect, test, type Page } from '@playwright/test';

// Lifecycle of a job (HU-02, RF-01 to RF-04 and RF-06) against the real API and web, on a database
// regenerated at start (playwright.config.ts). The jobs are created through the interface, because the flow
// is what is tested; each test uses its own fixed title (DD-09). Tests check jobs by ID or by their detail,
// never the list.

const FULL_JOB = {
  title: 'Técnica/o de selección',
  description: 'Gestiona procesos de selección de principio a fin.',
  location: 'Valencia',
  workMode: 'Híbrida',
  salaryMin: '32000',
  salaryMax: '40000',
};

type NewJob = {
  title: string;
  description?: string;
  location?: string;
  workMode?: string;
  salaryMin?: string;
  salaryMax?: string;
};

type ApiJob = {
  id: number;
  title: string;
  status: string;
  publishedAt: string | null;
  closedAt: string | null;
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
  return Number(new URL(page.url()).pathname.split('/').pop());
}

async function createPublishedJob(page: Page, title: string): Promise<number> {
  const id = await createJob(page, { ...FULL_JOB, title });
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Oferta publicada.')).toBeVisible();
  return id;
}

async function readJob(page: Page, id: number): Promise<ApiJob> {
  const response = await page.request.get(`/api/jobs/${id}`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as ApiJob;
}

/** The date as the web must show it: Europe/Madrid, dd/mm/aaaa, from the ISO date of the API (DEC-09). */
function madridDate(iso: string | null): string {
  expect(iso).not.toBeNull();
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso as string));
}

/** The `<dd>` that follows the `<dt>` with that label in the detail. */
function detailValue(page: Page, term: string) {
  return page.locator('dt', { hasText: term }).locator('+ dd');
}

/** Links and buttons of the action bar of the detail, in DOM order (the closed dialog is not accessible). */
function actionNames(page: Page) {
  const bar = page.locator('.actions');
  return bar.getByRole('link').or(bar.getByRole('button'));
}

function closeDialog(page: Page) {
  return page.getByRole('dialog', { name: '¿Cerrar la oferta?' });
}

/** Closes the job from its detail through the dialog (the flow of the page that closes in another tab). */
async function closeFromDetail(page: Page, id: number): Promise<void> {
  await page.goto(`/jobs/${id}`);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await closeDialog(page).getByRole('button', { name: 'Cerrar oferta' }).click();
  await expect(page.getByText('Oferta cerrada.')).toBeVisible();
}

test('CA-01/CA-23 publicar un borrador completo: acciones por estado y fecha de publicación', async ({
  page,
}) => {
  const id = await createJob(page, FULL_JOB);

  await expect(detailValue(page, 'Estado')).toHaveText('Borrador');
  await expect(actionNames(page)).toHaveText(['Editar', 'Publicar', 'Borrar', 'Duplicar']);
  await expect(page.locator('dt', { hasText: 'Fecha de publicación' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Publicar' }).click();

  await expect(page.getByText('Oferta publicada.')).toBeVisible();
  await expect(detailValue(page, 'Estado')).toHaveText('Publicada');
  await expect(actionNames(page)).toHaveText(['Editar', 'Cerrar', 'Duplicar']);
  const job = await readJob(page, id);
  expect(job.status).toBe('published');
  await expect(detailValue(page, 'Fecha de publicación')).toHaveText(madridDate(job.publishedAt));
});

test('CA-03 publicar con campos pendientes: avisa de lo que falta y sigue en borrador', async ({
  page,
}) => {
  await createJob(page, { title: 'Responsable de compras' });

  await page.getByRole('button', { name: 'Publicar' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Para publicar falta: Descripción, Ubicación, Modalidad.',
  );
  await expect(page.getByRole('link', { name: 'Editar' })).toBeVisible();
  await expect(detailValue(page, 'Estado')).toHaveText('Borrador');
  await expect(page.getByText('Oferta publicada.')).toHaveCount(0);
});

test('EC-43 con la API caída al publicar: alerta y el botón sigue disponible', async ({ page }) => {
  await createJob(page, { title: 'Técnico/a de compensación' });
  await page.route('**/publish', (route) => route.abort());

  await page.getByRole('button', { name: 'Publicar' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeEnabled();
  await expect(detailValue(page, 'Estado')).toHaveText('Borrador');
});

test('CA-05/CA-06/CA-22 cerrar con confirmación: Escape cancela y confirmar deja la ficha en solo lectura', async ({
  page,
}) => {
  const id = await createPublishedJob(page, 'Analista de reclutamiento');
  const dialog = closeDialog(page);

  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(detailValue(page, 'Estado')).toHaveText('Publicada');
  expect((await readJob(page, id)).status).toBe('published');

  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(dialog.getByText('Se rechazarán 0 inscripciones activas.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar oferta' }).click();

  await expect(page.getByText('Oferta cerrada.')).toBeVisible();
  await expect(detailValue(page, 'Estado')).toHaveText('Cerrada');
  await expect(actionNames(page)).toHaveText(['Duplicar']);
  await expect(page.getByText('Esta oferta está cerrada y no se puede modificar.')).toBeVisible();
  const job = await readJob(page, id);
  await expect(detailValue(page, 'Fecha de cierre')).toHaveText(madridDate(job.closedAt));
});

test('EC-13 otra pestaña cierra la oferta con el diálogo abierto: confirmar conserva la fecha de cierre', async ({
  context,
  page,
}) => {
  const id = await createPublishedJob(page, 'Técnico/a de nóminas');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(closeDialog(page).getByText('Se rechazarán 0 inscripciones activas.')).toBeVisible();

  const other = await context.newPage();
  await closeFromDetail(other, id);
  const firstClose = (await readJob(page, id)).closedAt;

  await closeDialog(page).getByRole('button', { name: 'Cerrar oferta' }).click();

  await expect(detailValue(page, 'Estado')).toHaveText('Cerrada');
  await expect(detailValue(page, 'Fecha de cierre')).toHaveText(madridDate(firstClose));
  expect((await readJob(page, id)).closedAt).toBe(firstClose);
});

test('CA-14 duplicar una cerrada: borrador nuevo con el mismo título y la original sigue cerrada', async ({
  page,
}) => {
  const title = 'Coordinador/a de onboarding';
  const originalId = await createPublishedJob(page, title);
  expect((await page.request.post(`/api/jobs/${originalId}/close`)).ok()).toBe(true);
  await page.goto(`/jobs/${originalId}`);
  await expect(detailValue(page, 'Estado')).toHaveText('Cerrada');

  await page.getByRole('button', { name: 'Duplicar' }).click();

  await page.waitForURL(
    (url) => /^\/jobs\/\d+$/.test(url.pathname) && url.pathname !== `/jobs/${originalId}`,
  );
  await expect(page.getByText('Oferta duplicada.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(detailValue(page, 'Estado')).toHaveText('Borrador');
  await expect(page.locator('dt', { hasText: 'Fecha de publicación' })).toHaveCount(0);
  await expect(actionNames(page)).toHaveText(['Editar', 'Publicar', 'Borrar', 'Duplicar']);
  const original = await readJob(page, originalId);
  expect(original.status).toBe('closed');
});

test('CA-11 vaciar un obligatorio de una publicada: error junto al campo y sin guardar', async ({
  page,
}) => {
  const id = await createPublishedJob(page, 'Responsable de formación');

  await page.getByRole('link', { name: 'Editar' }).click();
  await expect(page.getByLabel('Descripción (obligatorio)')).toBeVisible();
  await page.getByLabel('Descripción').fill('');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByText('Obligatorio en una oferta publicada.')).toBeVisible();
  await expect(page.getByLabel('Descripción')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(new RegExp(`/jobs/${id}/edit$`));
  expect((await readJob(page, id)).status).toBe('published');
});

test('CA-12/EC-44 guardar una oferta cerrada en otra pestaña: mensaje del 409 y ficha en solo lectura', async ({
  context,
  page,
}) => {
  const id = await createPublishedJob(page, 'Especialista en selección IT');
  await page.goto(`/jobs/${id}/edit`);
  await expect(page.getByLabel('Ubicación (obligatorio)')).toBeVisible();

  const other = await context.newPage();
  await closeFromDetail(other, id);

  await page.getByLabel('Ubicación').fill('Sevilla');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByRole('alert')).toHaveText('Una oferta cerrada no se puede editar.');
  await expect(page.getByRole('heading', { level: 1, name: 'Editar oferta' })).toBeVisible();
  await expect(page.getByLabel('Ubicación')).toHaveCount(0);

  await page.getByRole('link', { name: 'Ver la oferta' }).click();
  await expect(page).toHaveURL(new RegExp(`/jobs/${id}$`));
  await expect(detailValue(page, 'Estado')).toHaveText('Cerrada');
  await expect(detailValue(page, 'Ubicación')).toHaveText('Valencia');
  await expect(actionNames(page)).toHaveText(['Duplicar']);
});
