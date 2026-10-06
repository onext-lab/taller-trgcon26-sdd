import { expect, test, type Page } from '@playwright/test';

// Search and list of candidates (HU-03, RF-04) against the real API and web, on a database regenerated at start
// (playwright.config.ts). Each test creates its own candidates through the API with a unique surname and an
// `@example.com` email (DD-11) and filters by that surname; only the pagination test runs without filters, and
// there it relies on the seed having at least 30 candidates.

type ApiCandidate = { id: number; fullName: string; email: string };

let counter = 0;

function uniqueToken(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter}`;
}

async function createCandidateByApi(
  page: Page,
  fullName: string,
  skills: string[],
): Promise<ApiCandidate> {
  const response = await page.request.post('/api/candidates', {
    data: { fullName, email: `lista.${uniqueToken()}@example.com`, skills, consent: false },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ApiCandidate;
}

/** Three candidates that share a unique surname and differ in skills: `sql` + `rust`, `cobol` and none. */
async function createFamily(page: Page) {
  const surname = `Zq${uniqueToken()}`;
  const withSql = await createCandidateByApi(page, `Ana ${surname}`, ['rust', 'sql']);
  const withCobol = await createCandidateByApi(page, `Beatriz ${surname}`, ['cobol']);
  const withoutSkills = await createCandidateByApi(page, `Carla ${surname}`, []);
  return { surname, withSql, withCobol, withoutSkills };
}

function namesInTable(page: Page) {
  return page.getByRole('table').getByRole('link');
}

async function search(page: Page, text: string, skill = ''): Promise<void> {
  await page.getByLabel('Buscar por nombre o email').fill(text);
  await page.getByLabel('Skill').fill(skill);
  await page.getByRole('button', { name: 'Buscar' }).click();
}

test('CA-17 buscar por apellido único y skill: solo aparece el candidato esperado', async ({
  page,
}) => {
  const { surname, withSql, withCobol, withoutSkills } = await createFamily(page);

  await page.goto('/candidates');
  await search(page, surname);
  await expect(namesInTable(page)).toHaveCount(3);
  await expect(page.getByText('Página 1 de 1 (3 candidatos)')).toBeVisible();

  await search(page, surname.toUpperCase(), 'sql');
  await expect(namesInTable(page)).toHaveText([withSql.fullName]);
  await expect(page.getByRole('cell', { name: withSql.email, exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'rust, sql', exact: true })).toBeVisible();
  await expect(page.getByText(withCobol.fullName)).toHaveCount(0);
  await expect(page.getByText(withoutSkills.fullName)).toHaveCount(0);
  expect(new URL(page.url()).search).toBe('');
});

test('RF-04 sin filtros y con el seed (≥ 30): 20 filas y «Siguiente» lleva a la página 2', async ({
  page,
}) => {
  await page.goto('/candidates');

  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(21);
  await expect(namesInTable(page)).toHaveCount(20);
  const summary = await page.getByText(/^Página 1 de \d+ \(\d+ candidatos\)$/).innerText();
  expect(Number(/\((\d+) candidatos\)/.exec(summary)?.[1])).toBeGreaterThanOrEqual(30);

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText(/^Página 2 de \d+ \(\d+ candidatos\)$/)).toBeVisible();
  await expect(namesInTable(page).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anterior' })).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
});

test('DD-01 y RNF-09 buscar, abrir la ficha y volver: la búsqueda se restaura y la URL sigue siendo /candidates sin query', async ({
  page,
}) => {
  const { surname, withSql } = await createFamily(page);
  await page.goto('/candidates');
  await search(page, surname, 'sql');
  await expect(namesInTable(page)).toHaveText([withSql.fullName]);
  expect(new URL(page.url()).search).toBe('');

  await page.getByRole('link', { name: withSql.fullName }).click();
  await expect(page).toHaveURL(`/candidates/${withSql.id}`);
  await expect(page.getByRole('heading', { level: 1, name: withSql.fullName })).toBeVisible();
  await page.getByRole('link', { name: 'Volver a los candidatos' }).first().click();

  await expect(page.getByRole('heading', { level: 1, name: 'Candidatos' })).toBeVisible();
  await expect(page.getByLabel('Buscar por nombre o email')).toHaveValue(surname);
  await expect(page.getByLabel('Skill')).toHaveValue('sql');
  await expect(namesInTable(page)).toHaveText([withSql.fullName]);
  const url = new URL(page.url());
  expect(url.pathname).toBe('/candidates');
  expect(url.search).toBe('');
  // The e2e tsconfig has no `dom` types: `history` is reached through a minimal shape of `globalThis`.
  const historyState = await page.evaluate(
    () => (globalThis as unknown as { history: { state: unknown } }).history.state,
  );
  expect(historyState).toBeNull();
});

test('CA-21 con la API caída al buscar: alerta con «Reintentar» y, al volver, resultados con los filtros escritos', async ({
  page,
}) => {
  const { surname, withSql } = await createFamily(page);
  await page.goto('/candidates');
  await expect(page.getByRole('table')).toBeVisible();
  await page.route('**/api/candidates?**', (route) => route.abort());

  await search(page, surname, 'sql');

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByLabel('Buscar por nombre o email')).toHaveValue(surname);
  await expect(page.getByLabel('Skill')).toHaveValue('sql');

  await page.unroute('**/api/candidates?**');
  await page.getByRole('button', { name: 'Reintentar' }).click();

  await expect(namesInTable(page)).toHaveText([withSql.fullName]);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Buscar por nombre o email')).toHaveValue(surname);
  await expect(page.getByLabel('Skill')).toHaveValue('sql');
});
