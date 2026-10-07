import { expect, test, type Page } from '@playwright/test';
import {
  createCandidateByApi,
  createJobByApi,
  enrollByApi,
  pipelinePath,
  stageRegion,
  type ApiCandidate,
  type ApiJob,
} from './support/applications.ts';

// Stage changes of the pipeline and the detail of an application (HU-05, RF-05 to RF-07) against the real API and
// web, on a database regenerated at start (playwright.config.ts). Each test creates its own published job,
// candidate and application with a unique token and an `@example.com` email: hiring changes the retention of the
// candidate, so none is shared. The note is not sensitive and has two lines.

const NOTE_LINE_1 = 'Prefiere jornada parcial.';
const NOTE_LINE_2 = 'Disponible desde noviembre.';
const NOTE = `${NOTE_LINE_1}\n${NOTE_LINE_2}`;

type Enrolled = { job: ApiJob; candidate: ApiCandidate; applicationId: number };

async function enrollOwn(page: Page): Promise<Enrolled> {
  const job = await createJobByApi(page, 'published');
  const candidate = await createCandidateByApi(page);
  const { id } = await enrollByApi(page, job.id, candidate.id);
  return { job, candidate, applicationId: id };
}

function actionButton(page: Page, action: string, candidate: ApiCandidate) {
  // Chromium computes the name of the hidden span (position: absolute) with a space before the colon.
  const name = new RegExp(`^${action} ?: ${candidate.fullName}$`);
  return page.getByRole('button', { name });
}

function cardIn(page: Page, stage: string, candidate: ApiCandidate) {
  return stageRegion(page, stage).getByRole('listitem').filter({ hasText: candidate.fullName });
}

/** Opens the reject dialog of the card, picks the reason and writes the note; it does not confirm. */
async function fillRejectDialog(page: Page, candidate: ApiCandidate, note: string) {
  await actionButton(page, 'Rechazar', candidate).click();
  const dialog = page.getByRole('dialog', { name: 'Rechazar la inscripción' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: 'No encaja con el perfil' }).check();
  await dialog.getByRole('textbox', { name: 'Nota (opcional)' }).fill(note);
  return dialog;
}

async function rejectFromPipeline(page: Page, candidate: ApiCandidate, note: string) {
  const dialog = await fillRejectDialog(page, candidate, note);
  await dialog.getByRole('button', { name: 'Rechazar', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Inscripción rechazada.' }),
  ).toBeVisible();
}

test('CA-02, CA-40 y EC-03 avanzar de «Recibida» a «Contratado»: tres avances directos, la confirmación se cancela y se acepta', async ({
  page,
}) => {
  const { job, candidate } = await enrollOwn(page);
  await page.goto(pipelinePath(job));
  await expect(cardIn(page, 'Recibida', candidate)).toBeVisible();

  for (const [from, to] of [
    ['Recibida', 'Cribado'],
    ['Cribado', 'Entrevista'],
    ['Entrevista', 'Oferta'],
  ] as const) {
    await expect(cardIn(page, from, candidate)).toBeVisible();
    await actionButton(page, `Avanzar a ${to}`, candidate).click();
    await expect(
      page.getByRole('status').filter({ hasText: `Inscripción avanzada a ${to}.` }),
    ).toBeVisible();
    await expect(cardIn(page, to, candidate)).toBeVisible();
    await expect(cardIn(page, from, candidate)).toHaveCount(0);
  }

  // Hiring asks for confirmation: «Cancelar» leaves the card in «Oferta».
  await actionButton(page, 'Avanzar a Contratado', candidate).click();
  const dialog = page.getByRole('dialog', { name: '¿Contratar a este candidato?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  await expect(cardIn(page, 'Oferta', candidate)).toBeVisible();
  await expect(cardIn(page, 'Contratado', candidate)).toHaveCount(0);

  await actionButton(page, 'Avanzar a Contratado', candidate).click();
  await dialog.getByRole('button', { name: 'Contratar', exact: true }).click();
  await expect(dialog).toBeHidden();
  const hired = cardIn(page, 'Contratado', candidate);
  await expect(hired).toBeVisible();
  await expect(cardIn(page, 'Oferta', candidate)).toHaveCount(0);
  await expect(hired.getByRole('button')).toHaveCount(0);
});

test('CA-13 rechazar con motivo y nota de dos líneas: «Inscripción rechazada.» y la tarjeta en «Rechazado» con el motivo y sin la nota', async ({
  page,
}) => {
  const { job, candidate } = await enrollOwn(page);
  await page.goto(pipelinePath(job));

  await rejectFromPipeline(page, candidate, NOTE);

  const rejected = cardIn(page, 'Rechazado', candidate);
  await expect(rejected).toBeVisible();
  await expect(rejected).toContainText('Motivo: No encaja con el perfil');
  await expect(rejected.getByRole('button')).toHaveCount(0);
  await expect(cardIn(page, 'Recibida', candidate)).toHaveCount(0);
  await expect(page.getByText(NOTE_LINE_1)).toHaveCount(0);
  await expect(page.getByText(NOTE_LINE_2)).toHaveCount(0);
});

test('CA-24 y CA-26 de la tarjeta al detalle: etapa actual, historial en orden, rechazo, motivo y nota', async ({
  page,
}) => {
  const { job, candidate, applicationId } = await enrollOwn(page);
  await page.goto(pipelinePath(job));
  await actionButton(page, 'Avanzar a Cribado', candidate).click();
  await expect(cardIn(page, 'Cribado', candidate)).toBeVisible();
  await rejectFromPipeline(page, candidate, NOTE);

  await stageRegion(page, 'Rechazado')
    .getByRole('link', { name: candidate.fullName, exact: true })
    .click();

  await expect(page).toHaveURL(`/applications/${applicationId}`);
  await expect(page).toHaveTitle('Inscripción · ATS');
  await expect(page.getByRole('heading', { level: 1, name: 'Inscripción' })).toBeVisible();
  await expect(page.getByRole('link', { name: candidate.fullName, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: job.title, exact: true })).toHaveAttribute(
    'href',
    pipelinePath(job),
  );
  await expect(page.locator('dt', { hasText: 'Etapa actual' }).locator('+ dd')).toHaveText(
    'Rechazado',
  );

  const history = page.getByRole('list', { name: 'Historial' }).getByRole('listitem');
  await expect(history).toHaveCount(3);
  await expect(history.nth(0)).toContainText('— → Recibida');
  await expect(history.nth(1)).toContainText('Recibida → Cribado');
  await expect(history.nth(1)).not.toContainText('Motivo:');
  await expect(history.nth(2)).toContainText('Cribado → Rechazado');
  await expect(history.nth(2)).toContainText('Motivo: No encaja con el perfil');
  await expect(history.nth(2)).toContainText(NOTE_LINE_1);
  await expect(history.nth(2)).toContainText(NOTE_LINE_2);
  for (const entry of await history.all()) {
    await expect(entry).toContainText(/Fecha: \d{2}\/\d{2}\/\d{4}/);
  }
});

test('EC-40 y RNF-06 la nota del rechazo no está en la URL, el título ni history.state', async ({
  page,
}) => {
  const { job, candidate, applicationId } = await enrollOwn(page);
  await page.goto(pipelinePath(job));
  const dialog = await fillRejectDialog(page, candidate, NOTE);

  await expectNoteOutOfBrowserState(page, pipelinePath(job), 'Pipeline de la oferta · ATS');
  await dialog.getByRole('button', { name: 'Rechazar', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Inscripción rechazada.' }),
  ).toBeVisible();
  await expectNoteOutOfBrowserState(page, pipelinePath(job), 'Pipeline de la oferta · ATS');

  await page.getByRole('link', { name: candidate.fullName, exact: true }).click();
  await expect(page.getByText(NOTE_LINE_1)).toBeVisible();
  await expectNoteOutOfBrowserState(page, `/applications/${applicationId}`, 'Inscripción · ATS');
});

/** The note is only in the DOM of the dialog or the detail: not in the URL, the title or the history state. */
async function expectNoteOutOfBrowserState(page: Page, pathname: string, title: string) {
  const url = new URL(page.url());
  expect(url.pathname).toBe(pathname);
  expect(url.search).toBe('');
  expect(url.hash).toBe('');
  expect(decodeURIComponent(page.url())).not.toContain(NOTE_LINE_1);
  expect(await page.title()).toBe(title);
  // The e2e tsconfig has no `dom` types: `history` is reached through a minimal shape of `globalThis`.
  const historyState = await page.evaluate(() =>
    JSON.stringify((globalThis as unknown as { history: { state: unknown } }).history.state),
  );
  expect(historyState ?? 'null').not.toContain(NOTE_LINE_1);
}

test('CA-27 una inscripción que no existe: «Página no encontrada»', async ({ page }) => {
  await page.goto('/applications/999999999');

  await expect(page.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir a las ofertas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historial' })).toHaveCount(0);
});
