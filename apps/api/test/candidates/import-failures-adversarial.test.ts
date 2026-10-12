import type { FastifyInstance } from 'fastify';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { createCandidate, createProcessesStub } from '../helpers/candidates.ts';
import { CA01_ROWS, csvBytes, importCsv } from '../helpers/csv.ts';
import { createTestApp, createTestClock, failWrites } from '../helpers/test-app.ts';

// TASK-05 [adversarial] (UC-20 · E4, CA-06, CA-15, EC-30, EC-31, EC-37 a EC-41): la importación es todo o nada, no
// deja filas tras un fallo, se puede reintentar y la unicidad la decide el índice aunque haya otra escritura a la
// vez. Fallos reales (triggers de `failWrites`, puerto de procesos que lanza, cerrojo de otra conexión), sin mocks.
// Datos inventados.
const NOW = '2026-10-12T09:00:00.000Z';
const HEADER = 'nombre,email,telefono';
const GENERIC_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};
const RETENTION_TRIGGER = 'fail_candidates_update_retention_ends_at_when_id_';
const PAU = ['Pau Roig Mas', 'pau.roig@example.com', '+34 600 000 041'];

let app: FastifyInstance;
let db: DatabaseSync;

function start(options: Parameters<typeof createTestApp>[0] = {}): void {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now, ...options }));
}

beforeEach(() => start());

afterEach(async () => {
  await app.close();
});

function countCandidates(): number {
  return Number(db.prepare('SELECT COUNT(*) AS total FROM candidates').get()?.total);
}

function lines(rows: string[][]): string[] {
  return [HEADER, ...rows.map((cells) => cells.join(','))];
}

/** `count` filas válidas con emails distintos. */
function manyRows(count: number): string[][] {
  return Array.from({ length: count }, (_, i) => [
    `Persona ${i + 1} Prueba`,
    `persona${i + 1}@example.com`,
    '',
  ]);
}

function failRetentionOfRow(id: number): void {
  failWrites(db, 'UPDATE', {
    table: 'candidates',
    column: 'retention_ends_at',
    whenNew: { column: 'id', equals: id },
  });
}

/**
 * Una lectura (`SELECT`) no admite triggers: el fallo se inyecta en la propia conexión, solo para la consulta del ID
 * existente por email (`findIdByEmail`); el resto del SQL sigue siendo el real.
 */
function failReadOfExistingId(): void {
  const prepare = db.prepare.bind(db);
  db.prepare = (sql: string) => {
    if (sql.includes('SELECT id FROM candidates WHERE email')) throw new Error('lectura simulada');
    return prepare(sql);
  };
}

interface Report {
  dataRows: number;
  created: number;
  duplicates: number;
  invalid: number;
  notImported: { row: number; reason: string; existingId?: number }[];
}

describe('importación · todo o nada (CA-15, EC-37, EC-39, EC-41)', () => {
  it('CA-15 falla el recálculo de la 2.ª fila (UPDATE OF retention_ends_at, id = 2) → 500 y 0 creados; sin el trigger, 3 creados una vez', async () => {
    failRetentionOfRow(2);
    const bytes = csvBytes(lines(CA01_ROWS));

    const failed = await importCsv(app, bytes);

    expect(failed.statusCode).toBe(500);
    expect(failed.json()).toEqual(GENERIC_ERROR);
    expect(countCandidates()).toBe(0);

    db.exec(`DROP TRIGGER ${RETENTION_TRIGGER}2`);
    const retry = await importCsv(app, bytes);
    expect(retry.statusCode).toBe(200);
    expect(retry.json<Report>()).toMatchObject({ dataRows: 3, created: 3, duplicates: 0 });
    expect(countCandidates()).toBe(3);

    // EC-41: un segundo reintento no duplica nada, da las 3 filas como `duplicate`.
    const again = (await importCsv(app, bytes)).json<Report>();
    expect(again).toMatchObject({ dataRows: 3, created: 0, duplicates: 3, invalid: 0 });
    expect(again.notImported.map((entry) => entry.reason)).toEqual([
      'duplicate',
      'duplicate',
      'duplicate',
    ]);
    expect(countCandidates()).toBe(3);
  });

  it('EC-37/EC-39 falla el INSERT → 500, 0 creados y el recuento de antes', async () => {
    await createCandidate(app, { fullName: 'Ana Gil Prat', email: 'ana.gil@example.com' });
    await createCandidate(app, { fullName: 'Bru Mas Roca', email: 'bru.mas@example.com' });
    failWrites(db, 'INSERT', { table: 'candidates' });

    const response = await importCsv(app, csvBytes(lines(CA01_ROWS)));

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(GENERIC_ERROR);
    expect(countCandidates()).toBe(2);
  });

  it('EC-37 fila 250 de 500 → 500, 0 creados; sin el trigger, el reintento crea las 500', async () => {
    failRetentionOfRow(250);
    const bytes = csvBytes(lines(manyRows(500)));

    const failed = await importCsv(app, bytes);

    expect(failed.statusCode).toBe(500);
    expect(failed.json()).toEqual(GENERIC_ERROR);
    expect(countCandidates()).toBe(0);

    db.exec(`DROP TRIGGER ${RETENTION_TRIGGER}250`);
    const retry = await importCsv(app, bytes);
    expect(retry.json<Report>()).toMatchObject({ dataRows: 500, created: 500, duplicates: 0 });
    expect(countCandidates()).toBe(500);
  });
});

describe('importación · puerto de procesos (EC-30)', () => {
  it('EC-30 puerto de procesos que falla → 500 INTERNAL_ERROR y 0 creados', async () => {
    await app.close();
    start({ candidateProcesses: createProcessesStub({ fail: true }) });

    const response = await importCsv(app, csvBytes(lines(CA01_ROWS)));

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(GENERIC_ERROR);
    expect(countCandidates()).toBe(0);
  });

  it('EC-30 falla la lectura del existente tras el choque del índice → 500 y 0 creados', async () => {
    // El existente es la fila 2 del CSV: la fila 1 se inserta y la 2 choca con `candidates_email_uq`.
    await createCandidate(app, {
      fullName: 'Marcos Vidal Roca',
      email: 'marcos.vidal@example.com',
    });
    failReadOfExistingId();

    const response = await importCsv(app, csvBytes(lines(CA01_ROWS)));

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(GENERIC_ERROR);
    expect(response.body).not.toMatch(/example\.com|Marcos|Vidal|lectura simulada/);
    expect(countCandidates()).toBe(1); // solo el existente: ni la fila 1 ni la 3 quedan creadas
  });
});

describe('importación · a la vez que otra escritura (CA-06, EC-31)', () => {
  it('CA-06/EC-31 dos importaciones a la vez → 1 creado y 1 duplicate, ninguna 500', async () => {
    const bytes = csvBytes(lines([PAU]));

    const responses = await Promise.all([importCsv(app, bytes), importCsv(app, bytes)]);

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(countCandidates()).toBe(1);
    const existing = db.prepare('SELECT id FROM candidates WHERE email = ?').get(PAU[1]!);
    const reports = responses.map((response) => response.json<Report>());
    const created = reports.filter((report) => report.created === 1);
    const duplicated = reports.filter((report) => report.duplicates === 1);
    expect(created).toHaveLength(1);
    expect(duplicated).toHaveLength(1);
    expect(created[0]).toMatchObject({ dataRows: 1, invalid: 0, notImported: [] });
    expect(duplicated[0]).toMatchObject({ dataRows: 1, created: 0, invalid: 0 });
    expect(duplicated[0]?.notImported).toEqual([
      {
        row: 2,
        reason: 'duplicate',
        existingId: existing?.id,
        errors: [{ field: 'email', message: 'Duplicado.' }],
      },
    ]);
  });

  it.each(['la importación primero', 'el alta primero'])(
    'EC-31 importación y alta a la vez (%s) → duplicate o 409, un solo candidato y ninguna 500',
    async (order) => {
      const body = { fullName: PAU[0], email: PAU[1] };
      const doImport = () => importCsv(app, csvBytes(lines([PAU])));
      const doCreate = () => app.inject({ method: 'POST', url: '/api/candidates', payload: body });

      const [imported, created] =
        order === 'la importación primero'
          ? await Promise.all([doImport(), doCreate()])
          : (await Promise.all([doCreate(), doImport()])).reverse();

      expect(imported?.statusCode).toBe(200);
      expect(countCandidates()).toBe(1);
      const report = imported?.json<Report>();
      if (created?.statusCode === 201) {
        // El alta ganó: la importación ve el duplicado con el ID del alta.
        expect(report).toMatchObject({ created: 0, duplicates: 1 });
        expect(report?.notImported[0]?.existingId).toBe(created.json<{ id: number }>().id);
      } else {
        // La importación ganó: el alta da el 409 de siempre.
        expect(created?.statusCode).toBe(409);
        expect(report).toMatchObject({ created: 1, duplicates: 0 });
      }
    },
  );
});

describe('importación · cerrojo de otra conexión (EC-38)', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'ats-import-lock-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('EC-38 con otra conexión con el cerrojo, BEGIN falla → 500 sin cambios y el reintento crea', async () => {
    const path = join(dir, 'ats.db');
    const fileDb = openDatabase(path);
    migrate(fileDb);
    const fileApp = buildApp({ db: fileDb, now: createTestClock(NOW).now });
    const other = new DatabaseSync(path);
    try {
      await createCandidate(fileApp, { fullName: 'Ana Gil Prat', email: 'ana.gil@example.com' });
      const countBefore = () => fileDb.prepare('SELECT COUNT(*) AS total FROM candidates').get();
      other.exec('BEGIN IMMEDIATE');

      const blocked = await importCsv(fileApp, csvBytes(lines(CA01_ROWS)));

      expect(blocked.statusCode).toBe(500);
      expect(blocked.json()).toEqual(GENERIC_ERROR);
      other.exec('ROLLBACK');
      expect(Number(countBefore()?.total)).toBe(1);

      const retry = await importCsv(fileApp, csvBytes(lines(CA01_ROWS)));
      expect(retry.statusCode).toBe(200);
      expect(retry.json<Report>()).toMatchObject({ created: 3, duplicates: 0 });
      expect(Number(countBefore()?.total)).toBe(4);
    } finally {
      other.close();
      await fileApp.close(); // cierra también la base de la app
    }
  });
});
