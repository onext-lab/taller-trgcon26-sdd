import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { CA01_ROWS, csvBytes, importCsv } from '../helpers/csv.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';

// Flujos P, A1 y A2 de la importación (HU-07 TASK-03): alta todo o nada, deduplicación e informe. Datos inventados.
// Las reglas de fila (A3) y el contrato con el alta están en `import-rows.test.ts`.

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

function countByEmail(email: string): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM candidates WHERE email = ?').get(email);
  return Number(row?.total);
}

function lines(rows: string[][]): string[] {
  return [HEADER, ...rows.map((cells) => cells.join(','))];
}

async function getCandidate(id: number): Promise<Candidate> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${id}` });
  return response.json<Candidate>();
}

/** Importa en una app nueva (misma hora) y devuelve estado, informe y filas guardadas. */
async function importInFreshApp(bytes: Uint8Array) {
  const fresh = createTestApp({ now: createTestClock(NOW).now });
  try {
    const response = await importCsv(fresh.app, bytes);
    const saved = fresh.db.prepare('SELECT * FROM candidates ORDER BY id').all();
    return { status: response.statusCode, report: response.json(), saved };
  } finally {
    await fresh.app.close();
  }
}

describe('POST /api/candidates/import · alta', () => {
  it('CA-01 crea 3 sin consentimiento con retención 2027-04-12 y el informe no lista creadas', async () => {
    const response = await importCsv(app, csvBytes(lines(CA01_ROWS)));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      dataRows: 3,
      created: 3,
      duplicates: 0,
      invalid: 0,
      notImported: [],
    });
    const saved = db.prepare('SELECT * FROM candidates ORDER BY id').all();
    expect(saved).toHaveLength(3);
    expect(saved.map((row) => row.email)).toEqual([
      'lucia.ferrer@example.com',
      'marcos.vidal@example.com',
      'noa.serra@example.com',
    ]);
    expect(saved.map((row) => row.phone)).toEqual(['+34 600 000 012', null, '+34 600 000 014']);
    for (const row of saved) {
      expect(row).toMatchObject({
        summary: null,
        skills: '[]',
        created_at: NOW,
        consent_given_at: null,
        consent_version: null,
        consent_withdrawn_at: null,
        retention_ends_at: '2027-04-12',
      });
    }
  });

  it('CA-03 BOM + CRLF = mismo resultado', async () => {
    const plain = await importInFreshApp(csvBytes(lines(CA01_ROWS)));
    const excel = await importInFreshApp(
      csvBytes(lines(CA01_ROWS), { bom: true, eol: '\r\n', finalEol: true }),
    );

    expect(excel.status).toBe(200);
    expect(excel.report).toEqual(plain.report);
    expect(excel.saved).toEqual(plain.saved);
    expect(excel.saved).toHaveLength(3);
  });

  it('CA-04 duplicado con existingId y Ana sin cambios', async () => {
    const ana = await createCandidate(app, {
      fullName: 'Ana Gil',
      email: 'ana.gil@example.com',
      phone: '+34 600 000 020',
      consent: true,
    });
    const before = await getCandidate(ana.id);
    const total = countCandidates();

    const response = await importCsv(
      app,
      csvBytes([
        HEADER,
        ' Ana G.,ANA.GIL@example.com,+34 600 000 021',
        'Noa Serra,noa@example.com,',
      ]),
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      dataRows: 2,
      created: 1,
      duplicates: 1,
      invalid: 0,
      notImported: [
        {
          row: 2,
          reason: 'duplicate',
          existingId: ana.id,
          errors: [{ field: 'email', message: 'Duplicado.' }],
        },
      ],
    });
    expect(countCandidates()).toBe(total + 1);
    expect(countByEmail('ana.gil@example.com')).toBe(1);
    expect(await getCandidate(ana.id)).toEqual(before);
    expect(before).toMatchObject({ fullName: 'Ana Gil', phone: '+34 600 000 020' });
    const body = response.body.toLowerCase();
    expect(body).not.toContain('ana g.');
    expect(body).not.toContain('ana.gil@example.com');
  });

  it('CA-05 reimportar → 0 creados y 3 duplicate', async () => {
    const bytes = csvBytes(lines(CA01_ROWS));
    await importCsv(app, bytes);
    const total = countCandidates();

    const response = await importCsv(app, bytes);

    expect(response.statusCode).toBe(200);
    const report = response.json();
    expect(report).toMatchObject({ dataRows: 3, created: 0, duplicates: 3, invalid: 0 });
    expect(report.notImported.map((item: { row: number; reason: string }) => item.reason)).toEqual([
      'duplicate',
      'duplicate',
      'duplicate',
    ]);
    expect(report.notImported.map((item: { existingId: number }) => item.existingId)).toEqual([
      1, 2, 3,
    ]);
    expect(countCandidates()).toBe(total);
    expect(total).toBe(3);
  });

  it('EC-34 email existente repetido → todas duplicate', async () => {
    const ana = await createCandidate(app, { fullName: 'Ana Gil', email: 'ana.gil@example.com' });
    const total = countCandidates();

    const response = await importCsv(
      app,
      csvBytes(
        lines([
          ['Ana Uno', 'ana.gil@example.com', ''],
          ['Ana Dos', ' Ana.Gil@Example.com', ''],
          ['Ana Tres', 'ANA.GIL@EXAMPLE.COM', ''],
        ]),
      ),
    );

    expect(response.statusCode).toBe(200);
    const report = response.json();
    expect(report).toMatchObject({ dataRows: 3, created: 0, duplicates: 3, invalid: 0 });
    expect(report.notImported).toEqual(
      [2, 3, 4].map((row) => ({
        row,
        reason: 'duplicate',
        existingId: ana.id,
        errors: [{ field: 'email', message: 'Duplicado.' }],
      })),
    );
    expect(countCandidates()).toBe(total);
    expect(countByEmail('ana.gil@example.com')).toBe(1);
  });

  it('CA-07 repeated (firstRow) y fila inválida no es primera', async () => {
    const response = await importCsv(
      app,
      csvBytes([
        HEADER,
        ',x@example.com,',
        'Persona X,x@example.com,',
        'Persona X bis,X@example.com,',
        'Persona Y,y@example.com,',
      ]),
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      dataRows: 4,
      created: 2,
      duplicates: 1,
      invalid: 1,
      notImported: [
        { row: 2, reason: 'invalid', errors: [{ field: 'nombre', message: 'Es obligatorio.' }] },
        {
          row: 4,
          reason: 'repeated',
          firstRow: 3,
          errors: [{ field: 'email', message: 'Repetido en el fichero (fila 3).' }],
        },
      ],
    });
    expect(countCandidates()).toBe(2);
    expect(
      db.prepare('SELECT full_name FROM candidates WHERE email = ?').get('x@example.com'),
    ).toEqual({ full_name: 'Persona X' });
  });

  it('EC-29 500 filas mismo email', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => `Persona ${i},mismo@example.com,`);

    const response = await importCsv(app, csvBytes([HEADER, ...rows]));

    expect(response.statusCode).toBe(200);
    const report = response.json();
    expect(report).toMatchObject({ dataRows: 500, created: 1, duplicates: 499, invalid: 0 });
    expect(report.notImported).toHaveLength(499);
    expect(
      report.notImported.every(
        (item: { reason: string; firstRow: number }) =>
          item.reason === 'repeated' && item.firstRow === 2,
      ),
    ).toBe(true);
    expect(report.notImported[0].row).toBe(3);
    expect(report.notImported[498].row).toBe(501);
    expect(countCandidates()).toBe(1);
  });

  it('CA-09 todas inválidas → 200 con 0 creados', async () => {
    const response = await importCsv(
      app,
      csvBytes(
        lines([
          ['Ana Gil', 'sin-arroba', ''],
          ['', 'otra@example.com', ''],
        ]),
      ),
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ dataRows: 2, created: 0, duplicates: 0, invalid: 2 });
    expect(countCandidates()).toBe(0);
  });
});
