import { expect, test, type Page } from '@playwright/test';

// Create, edit, detail and consent of a candidate (HU-03, RF-01, RF-03, RF-05 and RF-06) against the real API and
// web, on a database regenerated at start (playwright.config.ts). Each test creates its own candidates with a
// unique name and an `@example.com` email (DD-11): the seed is never relied on, and no assertion fixes the absolute
// dates of the seed (DD-10). Candidates are created through the interface only when the flow is the one tested.

type ApiCandidate = {
  id: number;
  fullName: string;
  email: string;
  createdAt: string;
  consentGivenAt: string | null;
  consentVersion: string | null;
  consentWithdrawnAt: string | null;
  retentionEndsAt: string | null;
};

let counter = 0;

/** A lowercase letters-and-digits token that does not repeat between tests, runs or specs of the same database. */
function uniqueToken(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter}`;
}

/** Creates a candidate through the API (as `e2e/jobs-list.spec.ts` does with the jobs) and returns it. */
async function createCandidateByApi(
  page: Page,
  data: Record<string, unknown> & { fullName: string },
): Promise<ApiCandidate> {
  const token = uniqueToken();
  const response = await page.request.post('/api/candidates', {
    data: { email: `candidato.${token}@example.com`, consent: false, ...data },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ApiCandidate;
}

async function readCandidate(page: Page, id: number): Promise<ApiCandidate> {
  const response = await page.request.get(`/api/candidates/${id}`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as ApiCandidate;
}

function madridParts(iso: string): { year: number; month: number; day: number } {
  const text = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
  const [year, month, day] = text.split('-').map(Number);
  return { year: year as number, month: month as number, day: day as number };
}

function ddmmyyyy(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/** The date as the web must show it: Europe/Madrid, dd/mm/aaaa, from an ISO instant of the API (DEC-09). */
function madridDate(iso: string | null): string {
  expect(iso).not.toBeNull();
  const { year, month, day } = madridParts(iso as string);
  return ddmmyyyy(year, month, day);
}

/** `2027-04-06` (a calendar date of the API, without zone) as «06/04/2027». */
function calendarDate(date: string | null): string {
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const [year, month, day] = (date as string).split('-').map(Number);
  return ddmmyyyy(year as number, month as number, day as number);
}

/** Sign-up day in Europe/Madrid plus 6 months (a day that does not exist in the target month takes its last day). */
function sixMonthsAfter(createdAt: string): string {
  const { year, month, day } = madridParts(createdAt);
  const target = new Date(Date.UTC(year, month - 1 + 6, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return ddmmyyyy(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(day, lastDay));
}

/** The `<dd>` that follows the `<dt>` with that label in the detail. */
function detailValue(page: Page, term: string) {
  return page.locator('dt', { hasText: term }).locator('+ dd');
}

function idFromUrl(page: Page): number {
  return Number(new URL(page.url()).pathname.split('/').pop());
}

type FormData = { fullName: string; email: string; skills?: string; consent?: boolean };

/** Fills the sign-up form, sends it and waits for the detail of the new candidate; returns its ID. */
async function signUpByForm(page: Page, data: FormData): Promise<number> {
  await page.goto('/candidates/new');
  await page.getByLabel('Nombre y apellidos (obligatorio)').fill(data.fullName);
  await page.getByLabel('Email (obligatorio)').fill(data.email);
  if (data.skills) await page.getByLabel('Skills').fill(data.skills);
  if (data.consent) await page.getByLabel('El candidato da su consentimiento').check();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/\/candidates\/\d+$/);
  return idFromUrl(page);
}

test('CA-01 alta con email en mayúsculas y skills repetidas: la ficha los muestra normalizados y el fin de retención es alta + 6 meses', async ({
  page,
}) => {
  const token = uniqueToken();
  const fullName = `Alta Prueba ${token}`;
  const id = await signUpByForm(page, {
    fullName,
    email: `ALTA.${token.toUpperCase()}@EXAMPLE.COM`,
    skills: 'TypeScript, sql, typescript',
  });

  await expect(page.getByText('Candidato creado.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: fullName })).toBeVisible();
  await expect(detailValue(page, 'Email')).toHaveText(`alta.${token}@example.com`);
  await expect(detailValue(page, 'Skills')).toHaveText('typescript, sql');
  await expect(detailValue(page, 'Teléfono')).toHaveText('Sin indicar');
  const candidate = await readCandidate(page, id);
  await expect(detailValue(page, 'Fecha de alta')).toHaveText(madridDate(candidate.createdAt));
  await expect(detailValue(page, 'Fin de retención')).toHaveText(
    sixMonthsAfter(candidate.createdAt),
  );
  await expect(page.getByText('No consta consentimiento para futuros procesos.')).toBeVisible();
});

test('CA-03 y DD-04 alta con consentimiento: la versión junto a la casilla es la que guarda la API', async ({
  page,
}) => {
  const token = uniqueToken();
  await page.goto('/candidates/new');
  const shownVersion = /Versión del texto: (\S+)\./.exec(
    await page.getByText(/Versión del texto: \S+\./).innerText(),
  )?.[1];
  expect(shownVersion).toBeTruthy();

  const id = await signUpByForm(page, {
    fullName: `Consiente Prueba ${token}`,
    email: `consiente.${token}@example.com`,
    consent: true,
  });

  const candidate = await readCandidate(page, id);
  expect(candidate.consentVersion).toBe(shownVersion);
  await expect(page.getByText('Candidato creado.')).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'El candidato da su consentimiento' }),
  ).toBeChecked();
  const given = madridDate(candidate.consentGivenAt);
  await expect(
    page.getByText(`Vigente: otorgado el ${given} con la versión ${shownVersion} del texto.`),
  ).toBeVisible();
  await expect(detailValue(page, 'Fin de retención')).toHaveText(
    calendarDate(candidate.retentionEndsAt),
  );
});

test('CA-05 email ya usado: el mensaje junto al campo y el enlace abren la ficha del candidato existente', async ({
  page,
}) => {
  const existing = await createCandidateByApi(page, {
    fullName: `Existente Prueba ${uniqueToken()}`,
  });

  await page.goto('/candidates/new');
  await page
    .getByLabel('Nombre y apellidos (obligatorio)')
    .fill(`Repetido Prueba ${uniqueToken()}`);
  await page.getByLabel('Email (obligatorio)').fill(existing.email.toUpperCase());
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByText('Ya existe un candidato con este email.')).toBeVisible();
  await expect(page.getByLabel('Email (obligatorio)')).toHaveValue(existing.email.toUpperCase());
  await page.getByRole('link', { name: 'Ver el candidato existente' }).click();

  await expect(page).toHaveURL(`/candidates/${existing.id}`);
  await expect(page.getByRole('heading', { level: 1, name: existing.fullName })).toBeVisible();
});

test('CA-07 editar teléfono, resumen y skills: la ficha muestra los valores normalizados y el mismo fin de retención', async ({
  page,
}) => {
  const created = await createCandidateByApi(page, {
    fullName: `Edita Prueba ${uniqueToken()}`,
    phone: '600 000 000',
    summary: 'Resumen inicial.',
    skills: ['sql'],
  });
  await page.goto(`/candidates/${created.id}`);
  const retention = await detailValue(page, 'Fin de retención').innerText();
  expect(retention).toBe(sixMonthsAfter(created.createdAt));

  await page.getByRole('link', { name: 'Editar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Editar candidato' })).toBeVisible();
  await page.getByLabel('Teléfono').fill('  +34 611 222 333  ');
  await page.getByLabel('Resumen').fill('  Resumen nuevo.  ');
  await page.getByLabel('Skills').fill('Docker,  Node.js , docker');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page).toHaveURL(`/candidates/${created.id}`);
  await expect(page.getByText('Cambios guardados.')).toBeVisible();
  await expect(detailValue(page, 'Teléfono')).toHaveText('+34 611 222 333');
  await expect(detailValue(page, 'Resumen')).toHaveText('Resumen nuevo.');
  await expect(detailValue(page, 'Skills')).toHaveText('docker, node.js');
  await expect(detailValue(page, 'Fin de retención')).toHaveText(retention);
});

test('CA-22 y RNF-09 la ficha tiene título fijo y una URL con el ID, sin nombre ni email', async ({
  page,
}) => {
  const created = await createCandidateByApi(page, { fullName: `Titulo Prueba ${uniqueToken()}` });

  await page.goto(`/candidates/${created.id}`);

  await expect(page.getByRole('heading', { level: 1, name: created.fullName })).toBeVisible();
  await expect(page).toHaveTitle('Ficha de candidato · ATS');
  expect(new URL(page.url()).pathname).toBe(`/candidates/${created.id}`);
  expect(new URL(page.url()).search).toBe('');
  expect(await page.title()).not.toContain(created.fullName);
  expect(decodeURIComponent(page.url())).not.toContain(created.email);
});

function consentCheckbox(page: Page) {
  return page.getByRole('checkbox', { name: 'El candidato da su consentimiento' });
}

function withdrawDialog(page: Page) {
  return page.getByRole('dialog', { name: '¿Retirar el consentimiento?' });
}

/**
 * Tab (and Shift+Tab) from the dialog never lands on the page behind it, which is inert (RNF-07). The focus may
 * leave the document towards the browser UI (then nothing but `body` is focused), never to a control outside.
 */
async function expectFocusTrapped(page: Page): Promise<void> {
  const outsideDialog = page.locator(':focus:not(body):not(dialog *)');
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(withdrawDialog(page).getByRole('button', { name: 'Retirar' })).toBeFocused();
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press('Tab');
    await expect(outsideDialog).toHaveCount(0);
  }
  await page.keyboard.press('Shift+Tab');
  await expect(outsideDialog).toHaveCount(0);
}

test('CA-25 a CA-27 consentimiento: marcar, renovar, Escape sigue vigente, el foco no sale del diálogo y retirar', async ({
  page,
}) => {
  const created = await createCandidateByApi(page, { fullName: `Consent Prueba ${uniqueToken()}` });
  await page.goto(`/candidates/${created.id}`);
  await expect(page.getByText('No consta consentimiento para futuros procesos.')).toBeVisible();

  await consentCheckbox(page).click();
  await expect(page.getByText('Consentimiento registrado.')).toBeVisible();
  await expect(consentCheckbox(page)).toBeChecked();
  await expect(page.getByText(/^Vigente: otorgado el \d{2}\/\d{2}\/\d{4}/)).toBeVisible();

  await page.getByRole('button', { name: 'Renovar consentimiento' }).click();
  await expect(page.getByText('Consentimiento renovado.')).toBeVisible();
  await expect(consentCheckbox(page)).toBeChecked();

  await consentCheckbox(page).click();
  await expect(withdrawDialog(page)).toBeVisible();
  await expectFocusTrapped(page);
  await page.keyboard.press('Escape');
  await expect(withdrawDialog(page)).toBeHidden();
  await expect(consentCheckbox(page)).toBeChecked();
  await expect(page.getByText(/^Vigente: otorgado el/)).toBeVisible();
  expect((await readCandidate(page, created.id)).consentWithdrawnAt).toBeNull();

  await consentCheckbox(page).click();
  await withdrawDialog(page).getByRole('button', { name: 'Retirar' }).click();
  await expect(page.getByText('Consentimiento retirado.')).toBeVisible();
  await expect(consentCheckbox(page)).not.toBeChecked();
  await expect(page.getByText(/^Retirado el \d{2}\/\d{2}\/\d{4}\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Renovar consentimiento' })).toHaveCount(0);
  const withdrawn = await readCandidate(page, created.id);
  expect(withdrawn.consentWithdrawnAt).not.toBeNull();
  await expect(detailValue(page, 'Fin de retención')).toHaveText(sixMonthsAfter(created.createdAt));
});
