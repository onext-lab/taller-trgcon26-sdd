import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_MESSAGE } from '../../../src/components/http.ts';
import {
  chooseFile,
  clickImport,
  csvFile,
  envelope,
  expectRejected,
  fileInput,
  importButton,
  renderImport,
  report,
  SAMPLE_CSV,
} from './import-fixtures.ts';

const SEMICOLON_MESSAGE =
  'El fichero está separado por «;». Guárdalo separado por comas (CSV UTF-8) y vuelve a importarlo.';
const HEADER_MESSAGE =
  'La primera línea del fichero debe ser exactamente: nombre,email,telefono. Corrígela y vuelve a importarlo.';

describe('CandidateImportScreen · errores', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function rejectWith(status: number, message: string, field?: string): Promise<HTMLElement> {
    const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR';
    renderImport({ status, json: envelope(code, message, field) });
    chooseFile();
    clickImport();
    return expectRejected(message);
  }

  it('400 de cabecera: alert con nombre,email,telefono, foco al alert, fichero conservado (CA-11)', async () => {
    const alert = await rejectWith(400, HEADER_MESSAGE, 'file');

    expect(alert.textContent).toContain('nombre,email,telefono');
    expect(fileInput().getAttribute('aria-invalid')).toBe('true');
    expect(fileInput().getAttribute('aria-describedby')).toBe(`candidate-import-help ${alert.id}`);
  });

  it('CA-19 400 del separador «;»: alert con el texto de la API tal cual, foco al alert, fichero conservado y aria-invalid en el selector (EC-50)', async () => {
    const alert = await rejectWith(400, SEMICOLON_MESSAGE, 'file');

    expect(alert.id).toBe('candidate-import-error');
    expect(fileInput().getAttribute('aria-invalid')).toBe('true');
    expect(fileInput().getAttribute('aria-describedby')).toContain('candidate-import-error');
  });

  it('400 de formato con la línea 4 (CA-12)', async () => {
    await rejectWith(400, 'Formato CSV inválido: comillas sin cerrar. Revisa la línea 4.', 'file');
  });

  it('400 sin candidatos (CA-13)', async () => {
    await rejectWith(400, 'El fichero no tiene candidatos.', 'file');
  });

  it('400 de 501 filas (CA-14)', async () => {
    await rejectWith(
      400,
      'El fichero tiene más de 500 candidatos. Divídelo en ficheros más pequeños.',
      'file',
    );
  });

  it('413 → su message, con aria-invalid en el selector (CA-14)', async () => {
    await rejectWith(413, 'El fichero ocupa más de 1 MiB. Divídelo en ficheros más pequeños.');

    expect(fileInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('elegir otro fichero tras el error vuelve a ready: sin alert ni aria-invalid', async () => {
    await rejectWith(400, HEADER_MESSAGE, 'file');

    chooseFile(csvFile(SAMPLE_CSV, 'corregido.csv'));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(fileInput().getAttribute('aria-invalid')).toBeNull();
    expect(importButton().disabled).toBe(false);
  });

  it('500: alert, fichero conservado; reintento → informe (CA-15)', async () => {
    const replies = [
      { status: 500, json: envelope('INTERNAL_ERROR', 'Error interno. Inténtalo de nuevo.') },
      { status: 200, json: report({ dataRows: 3, created: 3 }) },
    ];
    const mock = renderImport(() => replies.shift() ?? { networkError: true });
    chooseFile();
    clickImport();

    await expectRejected('Error interno. Inténtalo de nuevo.');
    expect(fileInput().getAttribute('aria-invalid')).toBeNull();
    clickImport();

    await screen.findByRole('heading', { level: 2, name: 'Resultado de la importación' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe(
      '3 creados, 0 duplicados, 0 filas con error.',
    );
    expect(mock.calls).toHaveLength(2);
  });

  it('API caída: alert, fichero conservado, Importar activo (CA-16)', async () => {
    renderImport({ networkError: true });
    chooseFile();

    clickImport();

    await expectRejected(CONNECTION_MESSAGE);
    expect(fileInput().disabled).toBe(false);
  });
});
