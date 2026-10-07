import { expect, test, type Page } from '@playwright/test';
import { stageRegion } from './support/applications.ts';

// Pipeline of a closed job in read-only mode (HU-05, RF-08) against the real API and web. The closed job is only read
// and no ID is fixed: it is found through the API, and it may come from the seed or be one that
// `jobs-close-applications.spec.ts` closes before (HU-06); the assertions hold for either.

type ClosedPipeline = { jobId: number; applicationId: number; candidateName: string };

const STAGES = ['Recibida', 'Cribado', 'Entrevista', 'Oferta', 'Contratado', 'Rechazado'];

/** First closed job of the seed with an application rejected because the job closed. */
async function findClosedPipeline(page: Page): Promise<ClosedPipeline> {
  const closedList = await page.request.get('/api/jobs?status=closed');
  expect(closedList.ok()).toBe(true);
  const { items } = (await closedList.json()) as { items: { id: number }[] };
  for (const { id } of items) {
    const response = await page.request.get(`/api/jobs/${id}/applications`);
    expect(response.ok()).toBe(true);
    const pipeline = (await response.json()) as {
      items: { id: number; candidateName: string; rejectionReason: string | null }[];
    };
    const rejected = pipeline.items.find(({ rejectionReason }) => rejectionReason === 'job_closed');
    if (rejected) {
      return { jobId: id, applicationId: rejected.id, candidateName: rejected.candidateName };
    }
  }
  throw new Error('The seed has no closed job with an application rejected by the closing.');
}

test('CA-23, CA-26 y EC-50 oferta cerrada: «Ver pipeline», seis columnas sin acciones y el detalle de un rechazo «Oferta cerrada» sin nota', async ({
  page,
}) => {
  const closed = await findClosedPipeline(page);

  await page.goto(`/jobs/${closed.jobId}`);
  await page.getByRole('link', { name: 'Ver pipeline' }).click();
  await expect(page).toHaveURL(`/jobs/${closed.jobId}/pipeline`);
  await expect(page).toHaveTitle('Pipeline de la oferta · ATS');
  for (const stage of STAGES) {
    await expect(stageRegion(page, stage)).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Inscribir candidato' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Avanzar/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Rechazar/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Contratar/ })).toHaveCount(0);

  const rejected = stageRegion(page, 'Rechazado');
  await expect(
    rejected.getByRole('listitem').filter({ hasText: closed.candidateName }),
  ).toContainText('Motivo: Oferta cerrada');
  await rejected.getByRole('link', { name: closed.candidateName, exact: true }).click();

  const url = new URL(page.url());
  expect(url.pathname).toBe(`/applications/${closed.applicationId}`);
  expect(url.search).toBe('');
  await expect(page).toHaveTitle('Inscripción · ATS');
  await expect(page.locator('dt', { hasText: 'Etapa actual' }).locator('+ dd')).toHaveText(
    'Rechazado',
  );
  const lastChange = page.getByRole('list', { name: 'Historial' }).getByRole('listitem').last();
  await expect(lastChange).toContainText('→ Rechazado');
  await expect(lastChange).toContainText('Motivo: Oferta cerrada');
  await expect(lastChange).not.toContainText('Nota:');
});
