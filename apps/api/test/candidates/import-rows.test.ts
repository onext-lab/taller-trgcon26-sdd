import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { csvBytes, importCsv } from '../helpers/csv.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';

// Flujo A3 de la importación (HU-07 TASK-03): reglas de fila, numeración física e informe. Datos inventados.
// El alta, los duplicados y la hora están en `import.test.ts`.

const NOW = '2026-10-12T09:00:00.000Z';
const HEADER = 'nombre,email,telefono';
const COLUMNS_MESSAGE = 'Número de columnas incorrecto.';
const REQUIRED = 'Es obligatorio.';
const INVALID_FORMAT = 'Formato no válido.';

interface ReportRow {
  row: number;
  reason: string;
  errors: { field: string; message: string }[];
}

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

/** Importa una sola fila (o varias líneas) y devuelve el informe de un 200. */
async function importLines(dataLines: string[]) {
  const response = await importCsv(app, csvBytes([HEADER, ...dataLines]));
  expect(response.statusCode).toBe(200);
  return response.json<{
    dataRows: number;
    created: number;
    duplicates: number;
    invalid: number;
    notImported: ReportRow[];
  }>();
}

describe('POST /api/candidates/import · reglas de fila', () => {
  it('CA-08 errores por columna sin valores', async () => {
    const report = await importLines(['Ana Gil,ana@example.com,', ',no-es-email,abc123']);

    expect(report.notImported).toEqual([
      {
        row: 3,
        reason: 'invalid',
        errors: [
          { field: 'nombre', message: REQUIRED },
          { field: 'email', message: INVALID_FORMAT },
          { field: 'telefono', message: INVALID_FORMAT },
        ],
      },
    ]);
    expect(JSON.stringify(report)).not.toContain('no-es-email');
    expect(JSON.stringify(report)).not.toContain('abc123');
  });

  it('CA-10 numeración física', async () => {
    const report = await importLines([
      'Ana Gil,ana@example.com,',
      '"Nombre en',
      'dos líneas",mala,',
      '',
      'Persona Seis,mala,',
    ]);

    expect(report).toMatchObject({ dataRows: 3, created: 1, invalid: 2 });
    expect(report.notImported.map((item) => item.row)).toEqual([3, 6]);
  });

  it('EC-49 línea de espacios y tabuladores ignorada: ni en el informe ni en dataRows, la siguiente conserva su línea; cabecera + líneas de espacios → sin candidatos', async () => {
    const report = await importLines([
      'Ana Gil,ana@example.com,',
      'Noa Serra,noa@example.com,',
      '   \t ',
      'Persona Cinco,mala,',
    ]);

    expect(report).toMatchObject({ dataRows: 3, created: 2, duplicates: 0, invalid: 1 });
    expect(report.notImported.map((item) => item.row)).toEqual([5]);

    const empty = await importCsv(app, csvBytes([HEADER, '   ', '\t', ' \t ']));
    expect(empty.statusCode).toBe(400);
    expect(empty.json().error.message).toBe('El fichero no tiene candidatos.');
    expect(countCandidates()).toBe(2);
  });

  it('EC-19/EC-25 columnas y ,,', async () => {
    const report = await importLines([
      'Solo Dos,dos@example.com',
      'Uno Cuatro,cuatro@example.com,,extra',
      '"Ferrer, Lucía",lucia.ferrer@example.com,',
      ',,',
    ]);

    expect(report).toMatchObject({ dataRows: 4, created: 1, invalid: 3 });
    expect(report.notImported).toEqual([
      { row: 2, reason: 'invalid', errors: [{ field: 'fila', message: COLUMNS_MESSAGE }] },
      { row: 3, reason: 'invalid', errors: [{ field: 'fila', message: COLUMNS_MESSAGE }] },
      {
        row: 5,
        reason: 'invalid',
        errors: [
          { field: 'nombre', message: REQUIRED },
          { field: 'email', message: REQUIRED },
        ],
      },
    ]);
    expect(db.prepare('SELECT full_name, phone FROM candidates').all()).toEqual([
      { full_name: 'Ferrer, Lucía', phone: null },
    ]);
  });

  it('EC-20 controles en medio del nombre', async () => {
    const report = await importLines([
      'Ana\u0000Gil,nul@example.com,',
      'Ana\tGil,tab@example.com,',
      '"Ana\nGil",salto@example.com,',
      'Ana\rGil,cr@example.com,',
    ]);

    expect(report).toMatchObject({ dataRows: 4, created: 0, invalid: 4 });
    for (const item of report.notImported) {
      expect(item.errors).toEqual([{ field: 'nombre', message: INVALID_FORMAT }]);
    }
    expect(countCandidates()).toBe(0);
  });

  it('EC-21 bordes de longitud', async () => {
    const email = (length: number) => `${'a'.repeat(length - '@example.com'.length)}@example.com`;
    const valid = ['Ab', 'a'.repeat(100), '😀'.repeat(100)];
    const rows = [
      ...valid.map((name, i) => `${name},valido${i}@example.com,`),
      `Longitud 254,${email(254)},+${'6'.repeat(20)}`,
      'Seis dígitos,seis@example.com,123456',
      'Espacios,espacios@example.com,"   "',
      'A,uno@example.com,',
      `${'a'.repeat(101)},cien@example.com,`,
      `${'😀'.repeat(101)},emojis@example.com,`,
      `Longitud 255,${email(255)},`,
      `Veintiuno,veintiuno@example.com,+${'6'.repeat(21)}`,
      'Cinco,cinco@example.com,12345',
      '"   ",espacios2@example.com,',
    ];

    const report = await importLines(rows);

    expect(report).toMatchObject({ dataRows: 13, created: 6, invalid: 7 });
    expect(report.notImported.map((item) => [item.row, item.errors[0]?.field])).toEqual([
      [8, 'nombre'],
      [9, 'nombre'],
      [10, 'nombre'],
      [11, 'email'],
      [12, 'telefono'],
      [13, 'telefono'],
      [14, 'nombre'],
    ]);
    expect(report.notImported[6]?.errors).toEqual([{ field: 'nombre', message: REQUIRED }]);
    expect(
      db.prepare('SELECT phone FROM candidates WHERE email = ?').get('espacios@example.com'),
    ).toEqual({
      phone: null,
    });
  });

  it('EC-43/EC-46 suma = dataRows y 500 sin truncar', async () => {
    const invalidRows = Array.from({ length: 500 }, (_, i) =>
      i === 0 ? ',mala,abc' : `Persona ${i},mala${i},`,
    );
    const all = await importLines(invalidRows);

    expect(all).toMatchObject({ dataRows: 500, created: 0, duplicates: 0, invalid: 500 });
    expect(all.notImported).toHaveLength(500);
    expect(all.notImported[0]?.errors.map((error) => error.field)).toEqual([
      'nombre',
      'email',
      'telefono',
    ]);

    await importLines(['Ana Gil,ana@example.com,']);
    const mixed = await importLines([
      'Ana Gil,ana@example.com,',
      'Noa Serra,noa@example.com,',
      '',
      'Noa Dos,noa@example.com,',
      'Persona Mala,mala,',
      '   ',
      'Lucía Ferrer,lucia@example.com,',
    ]);

    expect(mixed).toMatchObject({ dataRows: 5, created: 2, duplicates: 2, invalid: 1 });
    expect(mixed.created + mixed.duplicates + mixed.invalid).toBe(mixed.dataRows);
    expect(mixed.notImported.map((item) => [item.row, item.reason])).toEqual([
      [2, 'duplicate'],
      [5, 'repeated'],
      [6, 'invalid'],
    ]);
  });
});
