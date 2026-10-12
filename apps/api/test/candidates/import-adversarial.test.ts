import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FILE_TOO_LARGE_MESSAGE,
  INVALID_CSV_MESSAGE,
  INVALID_HEADER_MESSAGE,
  MAX_IMPORT_BYTES,
  NO_CANDIDATES_MESSAGE,
  SEMICOLON_SEPARATOR_MESSAGE,
  TOO_MANY_ROWS_MESSAGE,
} from '../../src/modules/candidates/import-file.ts';
import { csvBytes, excelSpanishCsv, importCsv } from '../helpers/csv.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';

// Ficheros hostiles, tipos de contenido y límites por la ruta de importación (HU-07 TASK-04). Datos inventados.

const NOW = '2026-10-12T09:00:00.000Z';
const HEADER = 'nombre,email,telefono';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

function countCandidates(): number {
  return Number(db.prepare('SELECT COUNT(*) AS total FROM candidates').get()?.total);
}

function rows(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Persona ${i},persona${i}@example.com,`);
}

/** Un 400 del fichero entero: código, mensaje y el único `details` con el mismo texto, sin crear nada. */
async function expectFile400(bytes: Uint8Array, message: string): Promise<void> {
  const before = countCandidates();
  const response = await importCsv(app, bytes);
  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({
    error: { code: 'VALIDATION_ERROR', message, details: [{ field: 'file', message }] },
  });
  expect(countCandidates()).toBe(before);
}

describe('POST /api/candidates/import · cabecera', () => {
  it('EC-50 CSV de Excel en español (;, BOM y CRLF) → 400 con el mensaje del separador y 0 creados', async () => {
    const before = countCandidates();
    const response = await importCsv(app, excelSpanishCsv());

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: SEMICOLON_SEPARATOR_MESSAGE,
        details: [{ field: 'file', message: SEMICOLON_SEPARATOR_MESSAGE }],
      },
    });
    expect(response.body).not.toContain('nombre;email');
    expect(response.body).not.toContain('Lucía');
    expect(response.body).not.toContain('@example.com');
    expect(countCandidates()).toBe(before);
  });

  it('CA-11 cabeceras: ; → separador; otro orden y columna de más → cabecera esperada; " Nombre , EMAIL,Telefono" → 200', async () => {
    const row = 'Ana Gil,ana.cabecera@example.com,';
    await expectFile400(csvBytes(['nombre;email;telefono', row]), SEMICOLON_SEPARATOR_MESSAGE);
    await expectFile400(csvBytes(['email,nombre,telefono', row]), INVALID_HEADER_MESSAGE);
    await expectFile400(csvBytes(['nombre,email,telefono,resumen', row]), INVALID_HEADER_MESSAGE);
    expect(INVALID_HEADER_MESSAGE).toContain('nombre,email,telefono');

    const response = await importCsv(app, csvBytes([' Nombre , EMAIL,Telefono', row]));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ dataRows: 1, created: 1 });
    expect(countCandidates()).toBe(1);
  });

  it('EC-40 columna consentimiento → cabecera', async () => {
    const lines = [`${HEADER},consentimiento`, 'Ana Gil,ana.consent@example.com,,true'];
    await expectFile400(csvBytes(lines), INVALID_HEADER_MESSAGE);
  });
});

describe('POST /api/candidates/import · contenido del fichero', () => {
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00]);
  const latin1 = Uint8Array.from([
    ...new TextEncoder().encode(`${HEADER}\nLuc`),
    0xed,
    ...new TextEncoder().encode('a Gil,lucia.latin@example.com,\n'),
  ]);

  it('CA-12 Latin-1, PNG y comillas desde la línea 4', async () => {
    await expectFile400(latin1, INVALID_CSV_MESSAGE);
    await expectFile400(PNG, INVALID_CSV_MESSAGE);
    const unclosed = csvBytes([HEADER, ...rows(2), '"Sin cerrar,sin.cerrar@example.com,']);
    await expectFile400(unclosed, `${INVALID_CSV_MESSAGE} Revisa la línea 4.`);
  });

  it('CA-13 cuatro ficheros sin candidatos', async () => {
    await expectFile400(new Uint8Array(0), NO_CANDIDATES_MESSAGE);
    await expectFile400(csvBytes([], { bom: true }), NO_CANDIDATES_MESSAGE);
    await expectFile400(csvBytes([HEADER]), NO_CANDIDATES_MESSAGE);
    await expectFile400(csvBytes([HEADER, '', '', ''], { eol: '\r\n' }), NO_CANDIDATES_MESSAGE);
  });
});

/** Cabecera + una fila + `\n` de relleno hasta ocupar exactamente `size` bytes. */
function fileOfSize(size: number): Uint8Array {
  const head = new TextEncoder().encode(`${HEADER}\nAna Gil,ana.tamano@example.com,\n`);
  const bytes = new Uint8Array(size).fill(0x0a);
  bytes.set(head);
  return bytes;
}

describe('POST /api/candidates/import · límites', () => {
  it('CA-14 500 → 500 creados; 501 → 400 con el límite de filas y 0 creados; 1 048 576 → informe; 1 048 577 → 413', async () => {
    const at500 = await importCsv(app, csvBytes([HEADER, ...rows(500)]));
    expect(at500.statusCode).toBe(200);
    expect(at500.json()).toMatchObject({ dataRows: 500, created: 500, duplicates: 0, invalid: 0 });
    expect(countCandidates()).toBe(500);

    // 501 filas válidas y nuevas: sin la guarda de 500 se crearían.
    const extra = Array.from({ length: 501 }, (_, i) => `Otra ${i},otra${i}@example.com,`);
    await expectFile400(csvBytes([HEADER, ...extra]), TOO_MANY_ROWS_MESSAGE);
    expect(countCandidates()).toBe(500);

    const atLimit = await importCsv(app, fileOfSize(MAX_IMPORT_BYTES));
    expect(atLimit.statusCode).toBe(200);
    expect(atLimit.json()).toMatchObject({ dataRows: 1, created: 1 });
    expect(countCandidates()).toBe(501);

    const over = await importCsv(app, fileOfSize(MAX_IMPORT_BYTES + 1));
    expect(over.statusCode).toBe(413);
    expect(over.json()).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: FILE_TOO_LARGE_MESSAGE },
    });
    expect(countCandidates()).toBe(501);
  });

  it('EC-16 50 MiB → 413', async () => {
    const response = await importCsv(app, csvBytes([HEADER, ...rows(1)]), {
      'content-length': String(50 * 1024 * 1024),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: FILE_TOO_LARGE_MESSAGE },
    });
    expect(countCandidates()).toBe(0);
  });
});

describe('POST /api/candidates/import · tipos de contenido y origen', () => {
  const MEDIA_TYPES: [label: string, mediaType: string | undefined][] = [
    ['application/json', 'application/json'],
    ['text/plain', 'text/plain'],
    ['multipart/form-data', 'multipart/form-data'],
    ['application/x-www-form-urlencoded', 'application/x-www-form-urlencoded'],
    ['application/vnd.ms-excel', 'application/vnd.ms-excel'],
    ['application/octet-stream', 'application/octet-stream'],
    ['sin Content-Type', undefined],
  ];
  const validCsv = () => Buffer.from(csvBytes([HEADER, ...rows(3)]));

  it.each(MEDIA_TYPES)('415 con un CSV válido como cuerpo: %s', async (_label, mediaType) => {
    const headers: Record<string, string> = mediaType ? { 'content-type': mediaType } : {};
    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates/import',
      headers,
      payload: validCsv(),
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toEqual({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Tipo de contenido no admitido.' },
    });
    expect(countCandidates()).toBe(0);
  });

  it('415 control positivo: text/csv; charset=utf-8 → 200', async () => {
    const response = await importCsv(app, csvBytes([HEADER, ...rows(3)]), {
      'content-type': 'text/csv; charset=utf-8',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ created: 3 });
    expect(countCandidates()).toBe(3);
  });

  it('text/csv en POST /api/candidates sigue en 415', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      headers: { 'content-type': 'text/csv' },
      payload: validCsv(),
    });

    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(countCandidates()).toBe(0);
  });

  it('EC-06 cross-site → 403', async () => {
    const response = await importCsv(app, csvBytes([HEADER, ...rows(3)]), {
      'sec-fetch-site': 'cross-site',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CROSS_SITE_REQUEST');
    expect(countCandidates()).toBe(0);
  });
});

describe('POST /api/candidates/import · determinismo e inyección', () => {
  it('EC-17/EC-27 mismo resultado dos veces', async () => {
    const hostile = csvBytes([
      HEADER,
      'Sin Email,,',
      'A,no-es-email,abc',
      'Ana Gil,ana.ok@example.com,',
    ]);
    const first = await importCsv(app, hostile);
    const second = await importCsv(app, hostile);
    const secondNotImported = second.json().notImported;
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ dataRows: 3, created: 1, invalid: 2 });
    expect(secondNotImported.slice(0, 2)).toEqual(first.json().notImported);
    expect(second.json()).toMatchObject({ created: 0, duplicates: 1, invalid: 2 });

    const broken = csvBytes([HEADER, '"abierta,x@example.com,']);
    const a = await importCsv(app, broken);
    const b = await importCsv(app, broken);
    expect(a.statusCode).toBe(400);
    expect(b.statusCode).toBe(400);
    expect(b.json()).toEqual(a.json());
    expect(countCandidates()).toBe(1);
  });

  it('EC-26 <script>, =HYPERLINK y +34… guardados tal cual', async () => {
    const script = '<script>alert(1)</script>';
    const formula = '=HYPERLINK("http://example.com","x")';
    const response = await importCsv(
      app,
      csvBytes([
        HEADER,
        `${script},xss@example.com,+34 600 000 031`,
        `"=HYPERLINK(""http://example.com"",""x"")",formula@example.com,`,
      ]),
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ dataRows: 2, created: 2, notImported: [] });
    expect(response.body).not.toContain('script');
    expect(response.body).not.toContain('HYPERLINK');
    const saved = db.prepare('SELECT full_name, email, phone FROM candidates ORDER BY id').all();
    expect(saved).toEqual([
      { full_name: script, email: 'xss@example.com', phone: '+34 600 000 031' },
      { full_name: formula, email: 'formula@example.com', phone: null },
    ]);
  });
});
