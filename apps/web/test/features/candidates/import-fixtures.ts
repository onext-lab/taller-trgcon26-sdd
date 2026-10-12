import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { expect } from 'vitest';
import { CandidateImportScreen } from '../../../src/features/candidates/CandidateImportScreen.tsx';
import type { ImportReport } from '../../../src/features/candidates/types.ts';
import { mockFetch, type FetchMock, type MockRoute } from '../../helpers/fetch.ts';
import { expectFocusOn } from '../../helpers/focus.ts';

/** The route of `mockFetch` for the import. */
export const IMPORT_ROUTE = 'POST /api/candidates/import';

// Invented data only (`@example.com`, `+34 600 000 0xx`).
export const SAMPLE_CSV =
  'nombre,email,telefono\nAna Pérez Ruiz,ana.perez@example.com,+34 600 000 011\n' +
  'Luis Mora Vega,luis.mora@example.com,\nMar Soto Gil,mar.soto@example.com,+34 600 000 013\n';

/** A CSV `File` in memory; the name is invented too (the screen must never paint it). */
export function csvFile(content: string = SAMPLE_CSV, name = 'candidatos.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

/** A report with the given parts; the counts default to «nothing imported». */
export function report(parts: Partial<ImportReport> = {}): ImportReport {
  return { dataRows: 0, created: 0, duplicates: 0, invalid: 0, notImported: [], ...parts };
}

/** Wraps a body in the error envelope of the API (DEC-01). */
export function envelope(code: string, message: string, field?: string): { error: unknown } {
  const details = field ? { details: [{ field, message }] } : {};
  return { error: { code, message, ...details } };
}

/** Opens `/candidates/import` and renders the screen; `route` answers the `POST` (none: any call is unmatched). */
export function renderImport(route?: MockRoute): FetchMock {
  window.history.replaceState(null, '', '/candidates/import');
  const mock = mockFetch(route ? { [IMPORT_ROUTE]: route } : {});
  render(createElement(CandidateImportScreen));
  return mock;
}

export function fileInput(): HTMLInputElement {
  return screen.getByLabelText('Fichero CSV') as HTMLInputElement;
}

/** Chooses a file in the selector, as the browser does (`change` with a `FileList`). */
export function chooseFile(file: File = csvFile()): void {
  fireEvent.change(fileInput(), { target: { files: [file] } });
}

export function importButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Importar' }) as HTMLButtonElement;
}

export function clickImport(): void {
  fireEvent.click(importButton());
}

/** Chooses the sample file, imports it and waits for the report. */
export async function importAndWaitForReport(): Promise<void> {
  chooseFile();
  clickImport();
  await screen.findByRole('heading', { level: 2, name: 'Resultado de la importación' });
}

/** A rejected import: the alert says why and has the focus, the file stays chosen and «Importar» is active. */
export async function expectRejected(message: string): Promise<HTMLElement> {
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toBe(message);
  await expectFocusOn(() => screen.getByRole('alert'));
  expect(fileInput().files?.[0]?.name).toBe('candidatos.csv');
  expect(importButton().disabled).toBe(false);
  expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  return alert;
}
