import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INITIAL_LIST_QUERY,
  readListState,
  saveListState,
} from '../../../src/features/candidates/list-state.ts';
import { expectFocusOn } from '../../helpers/focus.ts';
import {
  chooseFile,
  clickImport,
  fileInput,
  importAndWaitForReport,
  importButton,
  renderImport,
  report,
  SAMPLE_CSV,
} from './import-fixtures.ts';

const DUPLICATE_ROW = {
  row: 3,
  reason: 'duplicate' as const,
  existingId: 7,
  errors: [{ field: 'email', message: 'Duplicado.' }],
};

describe('CandidateImportScreen · pantalla y informe', () => {
  beforeEach(() => saveListState(INITIAL_LIST_QUERY));

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('pantalla inicial: h1, cabecera, selector con label y accept .csv, Importar deshabilitado (CA-02, EC-02)', async () => {
    const mock = renderImport();

    expect(screen.getByRole('heading', { level: 1, name: 'Importar candidatos' })).toBeDefined();
    await waitFor(() => expect(document.title).toBe('Importar candidatos · ATS'));
    expect(screen.getByText('nombre,email,telefono').tagName).toBe('CODE');
    expect(fileInput().getAttribute('accept')).toBe('.csv');
    expect(fileInput().getAttribute('aria-describedby')).toBe('candidate-import-help');
    expect(fileInput().getAttribute('aria-invalid')).toBeNull();
    expect(importButton().disabled).toBe(true);
    fireEvent.click(importButton());
    fireEvent.submit(importButton().closest('form') as HTMLFormElement);
    expect(mock.calls).toHaveLength(0);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Importando… con Importar deshabilitado hasta el informe; foco al h2 (CA-02)', async () => {
    const mock = renderImport({ status: 200, json: report({ dataRows: 3, created: 3 }) });
    chooseFile();
    expect(importButton().disabled).toBe(false);

    clickImport();
    clickImport();

    expect(screen.getByRole('status').textContent).toBe('Importando…');
    expect(importButton().disabled).toBe(true);
    expect(fileInput().disabled).toBe(true);
    const heading = await screen.findByRole('heading', {
      level: 2,
      name: 'Resultado de la importación',
    });
    await expectFocusOn(() => heading);
    expect(screen.queryByText('Importando…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Importar' })).toBeNull();
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.headers['content-type']).toBe('text/csv');
    expect(new TextDecoder().decode(mock.calls[0]?.bytes)).toBe(SAMPLE_CSV);
  });

  it('muestra 3 creados y no lista filas creadas (CA-01)', async () => {
    renderImport({ status: 200, json: report({ dataRows: 3, created: 3 }) });

    await importAndWaitForReport();

    expect(screen.getByRole('status').textContent).toBe(
      '3 creados, 0 duplicados, 0 filas con error.',
    );
    expect(screen.getByText('Se han importado todas las filas.')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('candidatos.csv')).toBeNull();
    expect(screen.getByRole('button', { name: 'Importar otro fichero' })).toBeDefined();
  });

  it('fila duplicate con «Duplicado.» y Ver candidato a existingId, sin datos del existente (CA-04)', async () => {
    const mock = renderImport({
      status: 200,
      json: report({ dataRows: 3, created: 2, duplicates: 1, notImported: [DUPLICATE_ROW] }),
    });

    await importAndWaitForReport();

    expect(screen.getByRole('status').textContent).toBe(
      '2 creados, 1 duplicado, 0 filas con error.',
    );
    expect(screen.getByRole('table', { name: 'Filas no importadas' })).toBeDefined();
    const cells = within(screen.getAllByRole('row')[1] as HTMLElement).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual([
      '3',
      'email',
      'Duplicado. Ver candidato (se abre en una pestaña nueva)',
    ]);
    expect(
      within(cells[2] as HTMLElement)
        .getByRole('link')
        .getAttribute('href'),
    ).toBe('/candidates/7');
    expect(mock.calls.map((call) => call.method)).toEqual(['POST']);
  });

  it('nombre accesible, target y rel del enlace (CA-18)', async () => {
    renderImport({
      status: 200,
      json: report({ dataRows: 3, created: 2, duplicates: 1, notImported: [DUPLICATE_ROW] }),
    });

    await importAndWaitForReport();

    const link = screen.getByRole('link', { name: 'Ver candidato (se abre en una pestaña nueva)' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('href')).toBe('/candidates/7');
    expect(link.querySelector('.visually-hidden')?.textContent).toBe(
      '(se abre en una pestaña nueva)',
    );
  });

  it('Importar otro fichero y el mismo: segundo POST y 0 creados (CA-05, EC-07)', async () => {
    const replies = [report({ dataRows: 3, created: 3 }), report({ dataRows: 3, duplicates: 3 })];
    const mock = renderImport(() => ({ status: 200, json: replies.shift() }));
    await importAndWaitForReport();

    fireEvent.click(screen.getByRole('button', { name: 'Importar otro fichero' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Importar candidatos' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(fileInput().files).toHaveLength(0);
    expect(importButton().disabled).toBe(true);
    await expectFocusOn(() => fileInput());
    await importAndWaitForReport();
    expect(screen.getByRole('status').textContent).toBe(
      '0 creados, 3 duplicados, 0 filas con error.',
    );
    expect(mock.calls.map((call) => call.method)).toEqual(['POST', 'POST']);
  });

  it('pinta «Repetido en el fichero (fila 2).», los errores de nombre y email de la fila 3, «Toda la fila» con «Número de columnas incorrecto.» en la 4, y la fila 7 (CA-07, CA-08, CA-10)', async () => {
    const invalid3 = [
      { field: 'nombre', message: 'Es obligatorio.' },
      { field: 'email', message: 'Formato no válido.' },
    ];
    renderImport({
      status: 200,
      json: report({
        dataRows: 6,
        created: 1,
        duplicates: 1,
        invalid: 3,
        notImported: [
          { row: 3, reason: 'invalid', errors: invalid3 },
          {
            row: 4,
            reason: 'invalid',
            errors: [{ field: 'fila', message: 'Número de columnas incorrecto.' }],
          },
          {
            row: 5,
            reason: 'repeated',
            firstRow: 2,
            errors: [{ field: 'email', message: 'Repetido en el fichero (fila 2).' }],
          },
          {
            row: 7,
            reason: 'invalid',
            errors: [{ field: 'telefono', message: 'Formato no válido.' }],
          },
        ],
      }),
    });

    await importAndWaitForReport();

    expect(screen.getByRole('status').textContent).toBe(
      '1 creado, 1 duplicado, 3 filas con error.',
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['3', 'nombre', 'Es obligatorio.'],
      ['3', 'email', 'Formato no válido.'],
      ['4', 'Toda la fila', 'Número de columnas incorrecto.'],
      ['5', 'email', 'Repetido en el fichero (fila 2).'],
      ['7', 'telefono', 'Formato no válido.'],
    ]);
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Fila',
      'Columna',
      'Motivo',
    ]);
    expect(screen.queryByRole('link', { name: /Ver candidato/ })).toBeNull();
  });

  it('200 con 0 creados es un informe, no un error (CA-09)', async () => {
    renderImport({
      status: 200,
      json: report({
        dataRows: 1,
        invalid: 1,
        notImported: [
          { row: 2, reason: 'invalid', errors: [{ field: 'email', message: 'Es obligatorio.' }] },
        ],
      }),
    });

    await importAndWaitForReport();

    expect(screen.getByRole('status').textContent).toBe(
      '0 creados, 0 duplicados, 1 fila con error.',
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('table', { name: 'Filas no importadas' })).toBeDefined();
  });

  it('«Ir al listado» vuelve a /candidates con la búsqueda vacía (DD-05)', async () => {
    renderImport({ status: 200, json: report({ dataRows: 3, created: 3 }) });
    await importAndWaitForReport();
    saveListState({ ...INITIAL_LIST_QUERY, q: 'ana', page: 2 });

    const link = screen.getByRole('link', { name: 'Ir al listado' });
    expect(link.getAttribute('href')).toBe('/candidates');
    fireEvent.click(link);

    expect(readListState()).toEqual(INITIAL_LIST_QUERY);
    expect(window.location.pathname).toBe('/candidates');
  });
});
