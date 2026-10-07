import { expect, test, type Page } from '@playwright/test';
import {
  advanceByApi,
  createCandidateByApi,
  createJobByApi,
  enrollByApi,
  pipelinePath,
  stageRegion,
  type ApiCandidate,
} from './support/applications.ts';

// Closing a job that has applications from its detail page (HU-06, RF-05) against the real API and web, on a database
// regenerated at start (playwright.config.ts). The job, the candidates and the applications are created through the
// API with a unique token and an `@example.com` email: no ID and no data of the seed is relied on, and no seed job is
// closed. It is the first e2e that closes a job with applications, so a job closed here may be the one that
// `pipeline-closed.spec.ts` finds afterwards.

function closeDialog(page: Page) {
  return page.getByRole('dialog', { name: '¿Cerrar la oferta?' });
}

/** The card of the candidate in a stage; the surname carries the unique token, so it matches a single card. */
function cardIn(page: Page, stage: string, candidate: ApiCandidate) {
  return stageRegion(page, stage).getByRole('listitem').filter({ hasText: candidate.fullName });
}

/** A published job with A (received), B (interview) and C (hired), all enrolled and prepared through the API. */
async function prepareJobWithApplications(page: Page) {
  const job = await createJobByApi(page, 'published');
  const [a, b, c] = [
    await createCandidateByApi(page),
    await createCandidateByApi(page),
    await createCandidateByApi(page),
  ];
  await enrollByApi(page, job.id, a.id);
  const applicationB = await enrollByApi(page, job.id, b.id);
  const applicationC = await enrollByApi(page, job.id, c.id);
  await advanceByApi(page, applicationB.id, 'interview');
  await advanceByApi(page, applicationC.id, 'hired');
  return { job, a, b, c, applicationB };
}

test('CA-12 y EC-26 cerrar con 2 activas y 1 contratada: diálogo con 2, «Oferta cerrada.», pipeline en solo lectura y detalle «Oferta cerrada» sin nota', async ({
  page,
}) => {
  const { job, a, b, c, applicationB } = await prepareJobWithApplications(page);

  await page.goto(`/jobs/${job.id}`);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  const dialog = closeDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveText('Se rechazarán 2 inscripciones activas.');
  await dialog.getByRole('button', { name: 'Cerrar oferta' }).click();
  await expect(page.getByText('Oferta cerrada.')).toBeVisible();
  await expect(dialog).toBeHidden();

  await page.getByRole('link', { name: 'Ver pipeline' }).click();
  await expect(page).toHaveURL(pipelinePath(job));
  await expect(page.getByRole('button', { name: 'Inscribir candidato' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Avanzar/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Rechazar/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Contratar/ })).toHaveCount(0);

  await expect(cardIn(page, 'Rechazado', a)).toContainText('Motivo: Oferta cerrada');
  await expect(cardIn(page, 'Rechazado', b)).toContainText('Motivo: Oferta cerrada');
  await expect(cardIn(page, 'Contratado', c)).toBeVisible();
  await expect(cardIn(page, 'Contratado', c)).not.toContainText('Motivo:');
  await expect(cardIn(page, 'Recibida', a)).toHaveCount(0);
  await expect(cardIn(page, 'Entrevista', b)).toHaveCount(0);

  await stageRegion(page, 'Rechazado').getByRole('link', { name: b.fullName, exact: true }).click();
  await expect(page).toHaveURL(`/applications/${applicationB.id}`);
  await expect(page.locator('dt', { hasText: 'Etapa actual' }).locator('+ dd')).toHaveText(
    'Rechazado',
  );
  const lastChange = page.getByRole('list', { name: 'Historial' }).getByRole('listitem').last();
  await expect(lastChange).toContainText('Entrevista → Rechazado');
  await expect(lastChange).toContainText('Motivo: Oferta cerrada');
  await expect(lastChange).not.toContainText('Nota:');
});

test('EC-28 y EC-11 una inscripción creada con el diálogo abierto también se rechaza', async ({
  page,
}) => {
  const job = await createJobByApi(page, 'published');
  const [a, b] = [await createCandidateByApi(page), await createCandidateByApi(page)];
  await enrollByApi(page, job.id, a.id);

  await page.goto(`/jobs/${job.id}`);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  const dialog = closeDialog(page);
  await expect(dialog.getByRole('status')).toHaveText('Se rechazará 1 inscripción activa.');

  // The count of the dialog is already shown and is not recalculated (DT-03): B arrives after it.
  await enrollByApi(page, job.id, b.id);
  await dialog.getByRole('button', { name: 'Cerrar oferta' }).click();
  await expect(page.getByText('Oferta cerrada.')).toBeVisible();
  await expect(dialog).toBeHidden();

  await page.getByRole('link', { name: 'Ver pipeline' }).click();
  await expect(page).toHaveURL(pipelinePath(job));
  await expect(cardIn(page, 'Rechazado', a)).toContainText('Motivo: Oferta cerrada');
  await expect(cardIn(page, 'Rechazado', b)).toContainText('Motivo: Oferta cerrada');
  await expect(stageRegion(page, 'Recibida').getByRole('listitem')).toHaveCount(0);
});
