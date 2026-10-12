import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, BAD_RESPONSE_MESSAGE } from '../../../src/components/http.ts';
import { importCandidates, isImportReport } from '../../../src/features/candidates/api.ts';
import { mockFetch } from '../../helpers/fetch.ts';

const IMPORT = 'POST /api/candidates/import';

// The example of the «Contrato de API» of the TD-backend.
const CONTRACT_EXAMPLE = {
  dataRows: 5,
  created: 1,
  duplicates: 2,
  invalid: 2,
  notImported: [
    {
      row: 3,
      reason: 'invalid',
      errors: [
        { field: 'nombre', message: 'Es obligatorio.' },
        { field: 'email', message: 'Formato no válido.' },
      ],
    },
    {
      row: 4,
      reason: 'invalid',
      errors: [{ field: 'fila', message: 'Número de columnas incorrecto.' }],
    },
    {
      row: 5,
      reason: 'duplicate',
      existingId: 7,
      errors: [{ field: 'email', message: 'Duplicado.' }],
    },
    {
      row: 6,
      reason: 'repeated',
      firstRow: 2,
      errors: [{ field: 'email', message: 'Repetido en el fichero (fila 2).' }],
    },
  ],
};

function withRow(row: Record<string, unknown>): unknown {
  return { ...CONTRACT_EXAMPLE, notImported: [row] };
}

const ERRORS = [{ field: 'email', message: 'Duplicado.' }];

describe('isImportReport', () => {
  it('el ejemplo del Contrato de API del TD-backend pasa isImportReport', () => {
    expect(isImportReport(CONTRACT_EXAMPLE)).toBe(true);
  });

  it('un informe con 0 creados y sin filas no importadas pasa (CA-09)', () => {
    expect(
      isImportReport({ dataRows: 0, created: 0, duplicates: 0, invalid: 0, notImported: [] }),
    ).toBe(true);
  });

  it.each([
    ['recuento negativo', { ...CONTRACT_EXAMPLE, created: -1 }],
    ['recuento no entero', { ...CONTRACT_EXAMPLE, duplicates: 1.5 }],
    ['recuento como texto', { ...CONTRACT_EXAMPLE, invalid: '2' }],
    ['recuento NaN', { ...CONTRACT_EXAMPLE, dataRows: Number.NaN }],
    ['recuento fuera del rango seguro', { ...CONTRACT_EXAMPLE, dataRows: 2 ** 53 }],
    ['sin dataRows', { ...CONTRACT_EXAMPLE, dataRows: undefined }],
    ['notImported que no es un array', { ...CONTRACT_EXAMPLE, notImported: {} }],
    ['sin notImported', { ...CONTRACT_EXAMPLE, notImported: undefined }],
    ['null', null],
    ['un array', []],
    ['un texto', 'informe'],
  ])('%s → false', (_name, value) => {
    expect(isImportReport(value)).toBe(false);
  });

  it.each([
    ['reason fuera del enum', { row: 3, reason: 'ignored', errors: ERRORS }],
    ['sin reason', { row: 3, errors: ERRORS }],
    ['row 0', { row: 0, reason: 'invalid', errors: ERRORS }],
    ['row no entero', { row: 2.5, reason: 'invalid', errors: ERRORS }],
    ['errors vacío', { row: 3, reason: 'invalid', errors: [] }],
    ['sin errors', { row: 3, reason: 'invalid' }],
    ['un error sin message', { row: 3, reason: 'invalid', errors: [{ field: 'email' }] }],
    ['un error sin field', { row: 3, reason: 'invalid', errors: [{ message: 'Duplicado.' }] }],
    ['duplicate sin existingId', { row: 5, reason: 'duplicate', errors: ERRORS }],
    ['duplicate con existingId 0', { row: 5, reason: 'duplicate', existingId: 0, errors: ERRORS }],
    [
      'duplicate con existingId en texto',
      { row: 5, reason: 'duplicate', existingId: '7', errors: ERRORS },
    ],
    ['repeated sin firstRow', { row: 6, reason: 'repeated', errors: ERRORS }],
    [
      'repeated con firstRow negativo',
      { row: 6, reason: 'repeated', firstRow: -2, errors: ERRORS },
    ],
    ['un elemento que no es un objeto', 'fila 3'],
  ])('notImported con %s → false', (_name, row) => {
    expect(isImportReport(withRow(row as Record<string, unknown>))).toBe(false);
  });

  it('no comprueba que dataRows sea la suma: eso es de la API (EC-46)', () => {
    expect(isImportReport({ ...CONTRACT_EXAMPLE, dataRows: 99 })).toBe(true);
  });
});

describe('importCandidates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function bytesOf(file: File): Promise<ArrayBuffer> {
    return file.arrayBuffer();
  }

  it('devuelve el informe de un 200', async () => {
    mockFetch({ [IMPORT]: { status: 200, json: CONTRACT_EXAMPLE } });
    const bytes = new TextEncoder().encode('nombre,email,telefono\r\n').buffer;

    expect(await importCandidates(bytes)).toEqual(CONTRACT_EXAMPLE);
  });

  it.each(['', 'application/vnd.ms-excel'])(
    'envía Content-Type text/csv aunque el File tenga type %j',
    async (type) => {
      const mock = mockFetch({ [IMPORT]: { status: 200, json: CONTRACT_EXAMPLE } });
      const file = new File(['nombre,email,telefono\n'], 'candidatos.csv', { type });

      await importCandidates(await bytesOf(file));

      expect(mock.calls).toHaveLength(1);
      expect(mock.calls[0]?.method).toBe('POST');
      expect(mock.calls[0]?.headers['content-type']).toBe('text/csv');
    },
  );

  it('envía BOM, CRLF y ; tal cual (CA-03, EC-09, EC-12, EC-50)', async () => {
    const mock = mockFetch({ [IMPORT]: { status: 200, json: CONTRACT_EXAMPLE } });
    const text =
      '﻿nombre;email;telefono\r\nLucía Ferrer;lucia.ferrer@example.com;+34 600 000 011\r\n';
    const original = new TextEncoder().encode(text);
    const file = new File([original], 'excel.csv', { type: 'application/vnd.ms-excel' });

    await importCandidates(await bytesOf(file));

    const sent = Array.from(mock.calls[0]?.bytes ?? []);
    expect(sent.slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    expect(sent).toEqual(Array.from(original));
    expect(sent).toContain(0x0d);
    expect(sent).toContain(0x3b);
  });

  it('envía bytes que no son UTF-8 sin decodificarlos (Latin-1, CA-12)', async () => {
    const mock = mockFetch({ [IMPORT]: { status: 200, json: CONTRACT_EXAMPLE } });
    const latin1 = new Uint8Array([0x4d, 0x61, 0x72, 0xed, 0x61, 0x0a, 0xff, 0xfe]);

    await importCandidates(latin1.buffer);

    expect(Array.from(mock.calls[0]?.bytes ?? [])).toEqual(Array.from(latin1));
  });

  it.each([
    ['otra forma', { ok: true }],
    ['null', null],
    ['un recuento negativo', { ...CONTRACT_EXAMPLE, created: -1 }],
  ])('200 con %s → CLIENT_BAD_RESPONSE (EC-05)', async (_name, json) => {
    mockFetch({ [IMPORT]: { status: 200, json } });

    const error = await importCandidates(new ArrayBuffer(4)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect([(error as ApiError).status, (error as ApiError).code]).toEqual([
      0,
      'CLIENT_BAD_RESPONSE',
    ]);
    expect((error as ApiError).message).toBe(BAD_RESPONSE_MESSAGE);
  });

  it('200 que no es JSON → CLIENT_BAD_RESPONSE', async () => {
    mockFetch({ [IMPORT]: { status: 200, text: '<!doctype html>' } });

    const error = await importCandidates(new ArrayBuffer(4)).catch((e: unknown) => e);

    expect((error as ApiError).code).toBe('CLIENT_BAD_RESPONSE');
  });

  it('un 400 del fichero llega con su message y su detalle', async () => {
    const message = 'La primera línea debe ser la cabecera nombre,email,telefono.';
    mockFetch({
      [IMPORT]: {
        status: 400,
        json: {
          error: { code: 'VALIDATION_ERROR', message, details: [{ field: 'file', message }] },
        },
      },
    });

    const error = await importCandidates(new ArrayBuffer(4)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe(message);
    expect((error as ApiError).details).toEqual([{ field: 'file', message }]);
  });
});
