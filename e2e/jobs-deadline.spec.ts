import { expect, test, type Page } from '@playwright/test';
import { uniqueToken } from './support/applications.ts';

// Journey of the enrollment deadline (HU-07, RF-03 to RF-06) against the real API and web, on a database
// regenerated at start (playwright.config.ts). The jobs of E1 and E2 carry a unique token in the title. E3 reads the
// two jobs of the seed that have a deadline through the API and never fixes a day or an ID: the seed dates are
// relative to the reset (DEC-09), so it stays green any day it runs.

const DEADLINE_LABEL = 'Fecha límite de inscripción';
const FINAL_STAGES = ['hired', 'rejected'];

type PipelineResponse = {
  job: {
    id: number;
    status: string;
    enrollmentDeadline: string | null;
    enrollmentDeadlinePassed: boolean;
  };
  items: { id: number; stage: string }[];
};

function deadlineField(page: Page) {
  return page.getByLabel(DEADLINE_LABEL);
}

function deadlineTerm(page: Page) {
  return page.getByRole('term').filter({ hasText: DEADLINE_LABEL });
}

/** `2026-10-10` to `10/10/2026`, reordered here so the test does not reuse the format code of the web. */
function toDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

async function readPipeline(page: Page, jobId: number): Promise<PipelineResponse> {
  const response = await page.request.get(`/api/jobs/${jobId}/applications`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as PipelineResponse;
}

/** The published jobs with a deadline, read through the API: one whose deadline has passed and one that has not. */
async function findDeadlineJobs(
  page: Page,
): Promise<{ passed: PipelineResponse; future: PipelineResponse }> {
  const list = await page.request.get('/api/jobs?status=published&pageSize=100');
  expect(list.ok()).toBe(true);
  const { items } = (await list.json()) as { items: { id: number }[] };
  const pipelines: PipelineResponse[] = [];
  for (const { id } of items) pipelines.push(await readPipeline(page, id));
  const passed = pipelines.find(({ job }) => job.enrollmentDeadlinePassed);
  const future = pipelines.find(
    ({ job }) => job.enrollmentDeadline !== null && !job.enrollmentDeadlinePassed,
  );
  if (!passed || !future) {
    throw new Error(
      'The seed needs a published job with a passed deadline and one with a future deadline.',
    );
  }
  return { passed, future };
}

test('CA-01 y CA-03 crear con fecha límite, verla en la ficha y quitarla', async ({ page }) => {
  const title = `Oferta con plazo ${uniqueToken()}`;
  await page.goto('/jobs/new');
  await page.getByLabel('Título (obligatorio)').fill(title);
  await deadlineField(page).fill('2036-10-13');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText('Oferta creada.')).toBeVisible();
  await expect(deadlineTerm(page)).toHaveCount(1);
  await expect(page.getByRole('definition').filter({ hasText: '13/10/2036' })).toBeVisible();

  await page.getByRole('link', { name: 'Editar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Editar oferta' })).toBeVisible();
  await expect(deadlineField(page)).toHaveValue('2036-10-13');

  await deadlineField(page).fill('');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByText('Cambios guardados.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(deadlineTerm(page)).toHaveCount(0);
});

test('CA-02 una fecha pasada da el error junto al campo', async ({ page }) => {
  const title = `Oferta fecha pasada ${uniqueToken()}`;
  await page.goto('/jobs/new');
  await page.getByLabel('Título (obligatorio)').fill(title);
  await deadlineField(page).fill('2020-01-01');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(deadlineField(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(deadlineField(page)).toHaveAccessibleDescription(
    /La fecha límite no puede ser anterior a hoy\./,
  );
  await expect(page).toHaveURL(/\/jobs\/new$/);
  await expect(page.getByLabel('Título (obligatorio)')).toHaveValue(title);
});

test('CA-12, CA-13 y EC-25 seed: la vencida sin botón y con el texto; la de plazo futuro con botón', async ({
  page,
}) => {
  const { passed, future } = await findDeadlineJobs(page);
  const enrollButton = page.getByRole('button', { name: 'Inscribir candidato' });
  const passedDeadline = passed.job.enrollmentDeadline;
  expect(passedDeadline).not.toBeNull();
  const passedText = `El plazo de inscripción terminó el ${toDisplayDate(passedDeadline ?? '')}: no se pueden inscribir más candidatos.`;
  const notice = page.getByRole('status').filter({ hasText: passedText });
  const hasOpenCards = passed.items.some(({ stage }) => !FINAL_STAGES.includes(stage));

  await page.goto(`/jobs/${passed.job.id}/pipeline`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pipeline de la oferta' }),
  ).toBeVisible();
  await expect(notice).toBeVisible();
  await expect(enrollButton).toHaveCount(0);
  if (hasOpenCards) {
    await expect(page.getByRole('button', { name: /^Avanzar a/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Rechazar/ }).first()).toBeVisible();
  }

  await page.reload();
  await expect(notice).toBeVisible();
  await expect(enrollButton).toHaveCount(0);
  if (hasOpenCards) {
    await expect(page.getByRole('button', { name: /^Avanzar a/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Rechazar/ }).first()).toBeVisible();
  }

  await page.goto(`/jobs/${future.job.id}/pipeline`);
  await expect(enrollButton).toBeVisible();
  await expect(page.getByText(/El plazo de inscripción terminó/)).toHaveCount(0);
});
