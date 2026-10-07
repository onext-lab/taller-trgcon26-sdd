import { expect, test, type Page } from '@playwright/test';
import {
  createCandidateByApi,
  createJobByApi,
  enrollByApi,
  pipelinePath,
  stageRegion,
  type ApiJob,
} from './support/applications.ts';

// Enrollment of a candidate from the job pipeline (HU-04, RF-07, RF-08 and RF-10) against the real API and web, on
// a database regenerated at start (playwright.config.ts). Each test prepares its own published job and candidate
// through the API with a unique token and an `@example.com` email: no ID of the seed is relied on. Closing a job that
// has applications is covered by `jobs-close-applications.spec.ts` (HU-06).

function enrollPanel(page: Page) {
  return page.getByRole('region', { name: 'Inscribir candidato', exact: true });
}

/** Opens the enroll panel and searches; the single result is the candidate of the test. */
async function searchInPanel(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: 'Inscribir candidato' }).click();
  await enrollPanel(page).getByLabel('Nombre o email').fill(text);
  await enrollPanel(page).getByRole('button', { name: 'Buscar' }).click();
}

function enrollButton(page: Page) {
  return enrollPanel(page).getByRole('button', { name: 'Inscribir', exact: true });
}

test('CA-02, CA-14 y CA-19 inscribir desde el pipeline: la tarjeta queda la primera de «Recibida» y la ficha muestra la retención del proceso', async ({
  page,
}) => {
  const job = await createJobByApi(page, 'published');
  const candidate = await createCandidateByApi(page);

  await page.goto(`/jobs/${job.id}`);
  await page.getByRole('link', { name: 'Ver pipeline' }).click();
  await expect(page).toHaveURL(pipelinePath(job));
  await expect(page).toHaveTitle('Pipeline de la oferta · ATS');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pipeline de la oferta' }),
  ).toBeVisible();
  await expect(page.getByText('Todavía no hay candidatos inscritos en esta oferta.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inscribir candidato' })).toBeVisible();

  await searchInPanel(page, candidate.fullName.split(' ')[1] as string);
  await expect(enrollButton(page)).toBeVisible();
  await enrollButton(page).click();

  await expect(page.getByRole('status').filter({ hasText: 'Candidato inscrito.' })).toBeVisible();
  await expect(enrollPanel(page)).toHaveCount(0);
  const received = stageRegion(page, 'Recibida');
  await expect(received.getByRole('listitem').first()).toContainText(candidate.fullName);
  await expect(received.getByRole('listitem')).toHaveCount(1);

  await page.goto(`/candidates/${candidate.id}`);
  await expect(page.locator('dt', { hasText: 'Fin de retención' }).locator('+ dd')).toHaveText(
    'Mientras dure el proceso',
  );
});

test('CA-02 buscar por parte del email e inscribir: la tarjeta aparece en «Recibida»', async ({
  page,
}) => {
  const job = await createJobByApi(page, 'published');
  const candidate = await createCandidateByApi(page);
  const emailPart = candidate.email.split('@')[0] as string;

  await page.goto(pipelinePath(job));
  await searchInPanel(page, emailPart);
  await expect(enrollPanel(page).getByRole('cell', { name: candidate.email })).toBeVisible();
  await enrollButton(page).click();

  await expect(page.getByRole('status').filter({ hasText: 'Candidato inscrito.' })).toBeVisible();
  await expect(stageRegion(page, 'Recibida').getByRole('listitem').first()).toContainText(
    candidate.fullName,
  );
});

test('CA-36 inscribir a uno ya inscrito: el aviso fijo, «Ver la inscripción» al detalle existente y ninguna tarjeta nueva', async ({
  page,
}) => {
  const job = await createJobByApi(page, 'published');
  const candidate = await createCandidateByApi(page);
  const application = await enrollByApi(page, job.id, candidate.id);

  await page.goto(pipelinePath(job));
  const received = stageRegion(page, 'Recibida');
  await expect(received.getByRole('listitem')).toHaveCount(1);
  await searchInPanel(page, candidate.email);
  await enrollButton(page).click();

  const alert = enrollPanel(page).getByRole('alert');
  await expect(alert).toHaveText('Este candidato ya está inscrito en la oferta.');
  await expect(received.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: 'Candidato inscrito.' })).toHaveCount(0);

  const detailLink = enrollPanel(page).getByRole('link', { name: 'Ver la inscripción' });
  await expect(detailLink).toBeVisible();
  await detailLink.click();
  await expect(page).toHaveURL(`/applications/${application.id}`);
  await expect(page).toHaveTitle('Inscripción · ATS');
});

test('CA-26 y EC-28 borrador por URL y oferta cerrada del seed: el borrador no tiene columnas ni botón; la cerrada, columnas sin botón', async ({
  page,
}) => {
  const draft = await createJobByApi(page, 'draft');

  await page.goto(pipelinePath(draft));
  await expect(
    page.getByText('Esta oferta es un borrador: publícala para inscribir candidatos.'),
  ).toBeVisible();
  await expect(stageRegion(page, 'Recibida')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inscribir candidato' })).toHaveCount(0);

  const closedList = await page.request.get('/api/jobs?status=closed');
  expect(closedList.ok()).toBe(true);
  const { items } = (await closedList.json()) as { items: ApiJob[] };
  const closed = items[0];
  expect(closed).toBeDefined();

  await page.goto(pipelinePath(closed as ApiJob));
  for (const stage of ['Recibida', 'Cribado', 'Entrevista', 'Oferta', 'Contratado', 'Rechazado']) {
    await expect(stageRegion(page, stage)).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Inscribir candidato' })).toHaveCount(0);
});

test('RNF-05, EC-39 y EC-45 la búsqueda no sale del panel: ni la URL, ni el título, ni el estado del historial llevan el email', async ({
  page,
}) => {
  const job = await createJobByApi(page, 'published');
  const candidate = await createCandidateByApi(page);

  await page.goto(pipelinePath(job));
  await searchInPanel(page, candidate.email);
  await expect(enrollPanel(page).getByRole('cell', { name: candidate.email })).toBeVisible();

  const url = new URL(page.url());
  expect(url.pathname).toBe(pipelinePath(job));
  expect(url.search).toBe('');
  expect(decodeURIComponent(page.url())).not.toContain(candidate.email);
  const title = await page.title();
  expect(title).toBe('Pipeline de la oferta · ATS');
  expect(title).not.toContain(candidate.email);
  // The e2e tsconfig has no `dom` types: `history` is reached through a minimal shape of `globalThis`.
  const historyState = await page.evaluate(() =>
    JSON.stringify((globalThis as unknown as { history: { state: unknown } }).history.state),
  );
  expect(historyState ?? 'null').not.toContain(candidate.email);
});
