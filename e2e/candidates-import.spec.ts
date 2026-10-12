import { expect, test, type Page } from '@playwright/test';
import { createCandidateByApi, uniqueToken } from './support/applications.ts';

// CSV import of candidates (HU-07, FEAT-04) against the real API and web, on a database regenerated at start
// (playwright.config.ts). The CSV files are built in memory with a unique token (DD-08): nothing is read from or
// written to disk, and every name and email is made up (`@example.com`, `+34 600 000 0xx`).

const BOM = '﻿';
const SEMICOLON_SEPARATOR_MESSAGE =
  'El fichero está separado por «;». Guárdalo separado por comas (CSV UTF-8) y vuelve a importarlo.';

type CsvFile = { name: string; mimeType: string; buffer: Buffer };

function toFile(lines: string[], mimeType: string): CsvFile {
  return {
    name: 'candidatos.csv',
    mimeType,
    buffer: Buffer.from(lines.join('\r\n') + '\r\n', 'utf8'),
  };
}

/** Two new rows with the token, the email of an existing candidate in upper case, and a row with a bad email. */
function demoCsv(token: string, existingEmail: string): CsvFile {
  return toFile(
    [
      'nombre,email,telefono',
      `Importado Uno${token},uno.${token}@example.com,+34 600 000 040`,
      `Importado Dos${token},dos.${token}@example.com,`,
      `Repetido Existente,${existingEmail.toUpperCase()},`,
      ',mal@,',
    ],
    'text/csv',
  );
}

/** The file Excel saves on a Spanish computer: BOM, «;» as separator and CRLF; Windows types it as ms-excel. */
function excelSpanishCsv(token: string): CsvFile {
  return toFile(
    [
      `${BOM}nombre;email;telefono`,
      `Importado Excel${token};excel.${token}@example.com;+34 600 000 041`,
    ],
    'application/vnd.ms-excel',
  );
}

/** The same content as `excelSpanishCsv`, separated by commas as the screen asks. */
function commaCsv(token: string): CsvFile {
  return toFile(
    ['nombre,email,telefono', `Importado Excel${token},excel.${token}@example.com,+34 600 000 041`],
    'text/csv',
  );
}

// The layout has its own `role="status"` (API health): the messages of the screen are looked up inside <main>.
function main(page: Page) {
  return page.getByRole('main');
}

async function openImport(page: Page): Promise<void> {
  await page.goto('/candidates');
  await page.getByRole('link', { name: 'Importar CSV' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Importar candidatos' })).toBeVisible();
}

async function importFile(page: Page, file: CsvFile): Promise<void> {
  await page.getByLabel('Fichero CSV').setInputFiles(file);
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
}

async function totalByApi(page: Page, token: string): Promise<number> {
  const response = await page.request.get(`/api/candidates?q=${token}`);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { total: number }).total;
}

test('flujo de la demo: 2 creados, 1 duplicado y 1 fila con error', async ({ page, context }) => {
  const existing = await createCandidateByApi(page);
  const token = uniqueToken();

  await openImport(page);
  await importFile(page, demoCsv(token, existing.email));

  await expect(main(page).getByRole('status')).toHaveText('2 creados, 1 duplicado, 1 fila con error.');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Resultado de la importación' }),
  ).toBeVisible();

  const link = page.getByRole('link', { name: 'Ver candidato (se abre en una pestaña nueva)' });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('href', `/candidates/${existing.id}`);

  const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await expect(tab.getByRole('heading', { level: 1, name: existing.fullName })).toBeVisible();
  await tab.close();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Resultado de la importación' }),
  ).toBeVisible();

  // RNF-03: nothing of the file in the URL, the title, the history state or the browser storage.
  expect(new URL(page.url()).pathname).toBe('/candidates/import');
  await expect(page).toHaveTitle('Importar candidatos · ATS');
  const stored = await page.evaluate(() => {
    const scope = globalThis as unknown as {
      history: { state: unknown };
      localStorage: { length: number };
      sessionStorage: { length: number };
    };
    return {
      state: scope.history.state,
      local: scope.localStorage.length,
      session: scope.sessionStorage.length,
    };
  });
  expect(stored).toEqual({ state: null, local: 0, session: 0 });

  await page.getByRole('link', { name: 'Ir al listado' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Candidatos' })).toBeVisible();
  await page.getByLabel('Buscar por nombre o email').fill(token);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByRole('table').getByRole('link')).toHaveCount(2);
});

test('CA-19 CSV de Excel en español (;, BOM y CRLF) rechazado con el mensaje del separador, corregido y reimportado', async ({
  page,
}) => {
  const token = uniqueToken();

  await openImport(page);
  await importFile(page, excelSpanishCsv(token));

  await expect(main(page).getByRole('alert')).toHaveText(SEMICOLON_SEPARATOR_MESSAGE);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Resultado de la importación' }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Importar', exact: true })).toBeEnabled();
  expect(await totalByApi(page, token)).toBe(0);

  await importFile(page, commaCsv(token));
  await expect(main(page).getByRole('status')).toHaveText('1 creado, 0 duplicados, 0 filas con error.');
  expect(await totalByApi(page, token)).toBe(1);

  await page.getByRole('button', { name: 'Importar otro fichero' }).click();
  await importFile(page, commaCsv(token));
  await expect(main(page).getByRole('status')).toHaveText('0 creados, 1 duplicado, 0 filas con error.');
  expect(await totalByApi(page, token)).toBe(1);
});
