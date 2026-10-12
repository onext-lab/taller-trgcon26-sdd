import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BAD_RESPONSE_MESSAGE } from '../../../src/components/http.ts';
import {
  FILE_TOO_LARGE_MESSAGE,
  FILE_UNREADABLE_MESSAGE,
} from '../../../src/features/candidates/import-model.ts';
import type { NotImportedRow } from '../../../src/features/candidates/types.ts';
import {
  chooseFile,
  clickImport,
  csvFile,
  envelope,
  expectRejected,
  fileInput,
  importAndWaitForReport,
  importButton,
  renderImport,
  report,
  SAMPLE_CSV,
} from './import-fixtures.ts';
import { expectFocusOn } from '../../helpers/focus.ts';

const MAX_BYTES = 1_048_576;
const REPORT_HEADING = { level: 2, name: 'Resultado de la importación' } as const;

/** A file whose bytes must not be read: `arrayBuffer` fails the test if it is called. */
function unreadableFile(size: number): { file: File; read: ReturnType<typeof vi.fn> } {
  const file = new File([new Uint8Array(size)], 'candidatos.csv', { type: 'text/csv' });
  const read = vi.fn(() => Promise.reject(new Error('the file must not be read')));
  Object.defineProperty(file, 'arrayBuffer', { value: read });
  return { file, read };
}

const DUPLICATE_ROW: NotImportedRow = {
  row: 3,
  reason: 'duplicate',
  existingId: 7,
  errors: [{ field: 'email', message: 'Duplicado.' }],
};

function invalidRow(row: number, fields: string[]): NotImportedRow {
  return {
    row,
    reason: 'invalid',
    errors: fields.map((field) => ({ field, message: 'Formato no válido.' })),
  };
}

describe('CandidateImportScreen · adversarial', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('EC-01 foto.png y .txt se envían igual: PNG → alert con el message del 400; .txt → informe', async () => {
    const message = 'Formato CSV inválido: el fichero no es texto. Revisa la línea 1.';
    const replies = [
      { status: 400, json: envelope('VALIDATION_ERROR', message, 'file') },
      { status: 200, json: report({ dataRows: 3, created: 3 }) },
    ];
    const mock = renderImport(() => replies.shift() ?? { networkError: true });
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'foto.png', {
      type: 'image/png',
    });

    chooseFile(png);
    clickImport();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(message);
    expect(screen.queryByRole('heading', REPORT_HEADING)).toBeNull();
    chooseFile(csvFile(SAMPLE_CSV, 'candidatos.txt'));
    clickImport();

    await screen.findByRole('heading', REPORT_HEADING);
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls.every((call) => call.headers['content-type'] === 'text/csv')).toBe(true);
    expect(Array.from(mock.calls[0]?.bytes ?? [])).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(new TextDecoder().decode(mock.calls[1]?.bytes)).toBe(SAMPLE_CSV);
  });

  it('EC-04 doble clic → 1 POST', async () => {
    const mock = renderImport({ status: 200, json: report({ dataRows: 3, created: 3 }) });
    chooseFile();

    clickImport();
    clickImport();
    clickImport();

    await screen.findByRole('heading', REPORT_HEADING);
    expect(mock.calls.map((call) => call.method)).toEqual(['POST']);
  });

  it('EC-05 200 con otra forma → alert BAD_RESPONSE_MESSAGE y sin h2 de informe', async () => {
    renderImport({ status: 200, json: { created: '3', notImported: 'nada' } });
    chooseFile();

    clickImport();

    await expectRejected(BAD_RESPONSE_MESSAGE);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('EC-06 / EC-47 nada en URL, título, history.state ni almacenamiento (informe con duplicados y errores)', async () => {
    renderImport({
      status: 200,
      json: report({
        dataRows: 4,
        created: 1,
        duplicates: 1,
        invalid: 2,
        notImported: [DUPLICATE_ROW, invalidRow(4, ['email']), invalidRow(5, ['telefono'])],
      }),
    });
    chooseFile(csvFile(SAMPLE_CSV, 'candidatos_lucia_ferrer.csv'));
    clickImport();

    await screen.findByRole('heading', REPORT_HEADING);

    await waitFor(() => expect(document.title).toBe('Importar candidatos · ATS'));
    expect(window.location.href).toBe(`${window.location.origin}/candidates/import`);
    expect(window.history.state).toBeNull();
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
    expect(document.body.textContent).not.toContain('candidatos_lucia_ferrer');
    expect(document.body.textContent).not.toContain('lucia');
    expect(document.body.innerHTML).not.toContain('.csv');
  });

  it('EC-11 / EC-16 1 048 576 bytes se envía; 1 048 577 → FILE_TOO_LARGE_MESSAGE sin petición', async () => {
    const mock = renderImport({ status: 200, json: report({ dataRows: 3, created: 3 }) });
    chooseFile(new File([new Uint8Array(MAX_BYTES)], 'justo.csv', { type: 'text/csv' }));
    clickImport();
    await screen.findByRole('heading', REPORT_HEADING);
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.bytes?.byteLength).toBe(MAX_BYTES);
    cleanup();

    const big = unreadableFile(MAX_BYTES + 1);
    const second = renderImport({ status: 200, json: report() });
    chooseFile(big.file);
    clickImport();

    await expectRejected(FILE_TOO_LARGE_MESSAGE);
    expect(fileInput().getAttribute('aria-invalid')).toBe('true');
    expect(second.calls).toHaveLength(0);
    expect(big.read).not.toHaveBeenCalled();
  });

  it('EC-13 fichero ilegible → FILE_UNREADABLE_MESSAGE sin petición; elegir otro lo arregla', async () => {
    const mock = renderImport({ status: 200, json: report({ dataRows: 3, created: 3 }) });
    const broken = unreadableFile(10);
    chooseFile(broken.file);

    clickImport();

    await expectRejected(FILE_UNREADABLE_MESSAGE);
    expect(broken.read).toHaveBeenCalledTimes(1);
    expect(mock.calls).toHaveLength(0);
    chooseFile(csvFile(SAMPLE_CSV, 'otro.csv'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(importButton().disabled).toBe(false);
    clickImport();
    await screen.findByRole('heading', REPORT_HEADING);
    expect(mock.calls).toHaveLength(1);
  });

  it('EC-17 mismo inválido dos veces → mismo alert y 2 POST', async () => {
    const message = 'La primera línea del fichero debe ser exactamente: nombre,email,telefono.';
    const mock = renderImport({ status: 400, json: envelope('VALIDATION_ERROR', message, 'file') });
    chooseFile();
    clickImport();
    await expectRejected(message);

    clickImport();

    await expectRejected(message);
    expect(mock.calls.map((call) => call.method)).toEqual(['POST', 'POST']);
  });

  it('EC-26 message con <img onerror> → texto literal y 0 img', async () => {
    const hostile = '<img src=x onerror="alert(1)"> =HYPERLINK("http://x")';
    renderImport({ status: 400, json: envelope('VALIDATION_ERROR', hostile, 'file') });
    chooseFile();
    clickImport();

    await expectRejected(hostile);

    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  it('EC-26 los motivos del informe también son texto literal', async () => {
    const hostile = '<img src=x onerror="alert(1)">';
    renderImport({
      status: 200,
      json: report({
        dataRows: 1,
        invalid: 1,
        notImported: [
          { row: 2, reason: 'invalid', errors: [{ field: '<b>email</b>', message: hostile }] },
        ],
      }),
    });

    await importAndWaitForReport();

    const cells = within(screen.getAllByRole('row')[1] as HTMLElement).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual(['2', '<b>email</b>', hostile]);
    expect(document.querySelectorAll('img, b')).toHaveLength(0);
  });

  it('EC-33 duplicate → solo el POST, 0 GET /api/candidates/:id', async () => {
    const mock = renderImport({
      status: 200,
      json: report({
        dataRows: 3,
        created: 2,
        duplicates: 1,
        notImported: [DUPLICATE_ROW],
      }),
    });

    await importAndWaitForReport();

    expect(screen.getByRole('link', { name: /Ver candidato/ }).getAttribute('href')).toBe(
      '/candidates/7',
    );
    expect(mock.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /api/candidates/import',
    ]);
    expect(mock.unmatched).toHaveLength(0);
  });

  it('EC-43 500 filas sin truncar: 500 filas de tabla', async () => {
    const rows = Array.from({ length: 500 }, (_, index) => invalidRow(index + 2, ['email']));
    renderImport({ status: 200, json: report({ dataRows: 500, invalid: 500, notImported: rows }) });

    await importAndWaitForReport();

    const table = screen.getByRole('table', { name: 'Filas no importadas' });
    expect(within(table).getAllByRole('row')).toHaveLength(501);
    expect(screen.getByRole('status').textContent).toBe(
      '0 creados, 0 duplicados, 500 filas con error.',
    );
  }, 20_000);

  it('EC-43 fila 5 con 3 errores → 3 filas de tabla (nombre, email, telefono)', async () => {
    renderImport({
      status: 200,
      json: report({
        dataRows: 5,
        created: 4,
        invalid: 1,
        notImported: [invalidRow(5, ['nombre', 'email', 'telefono'])],
      }),
    });

    await importAndWaitForReport();

    const body = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(
      body.map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['5', 'nombre', 'Formato no válido.'],
      ['5', 'email', 'Formato no válido.'],
      ['5', 'telefono', 'Formato no válido.'],
    ]);
    expect(screen.getByRole('status').textContent).toBe(
      '4 creados, 0 duplicados, 1 fila con error.',
    );
  });

  it('EC-48 Importar otro fichero → estado inicial sin fichero ni informe; sin entradas de historial nuevas', async () => {
    const mock = renderImport({ status: 200, json: report({ dataRows: 3, created: 3 }) });
    const entries = window.history.length;
    await importAndWaitForReport();

    fireEvent.click(screen.getByRole('button', { name: 'Importar otro fichero' }));

    await expectFocusOn(() => fileInput());
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(fileInput().files).toHaveLength(0);
    expect(importButton().disabled).toBe(true);
    expect(window.history.length).toBe(entries);
    expect(window.history.state).toBeNull();
    expect(mock.calls).toHaveLength(1);
  });
});
