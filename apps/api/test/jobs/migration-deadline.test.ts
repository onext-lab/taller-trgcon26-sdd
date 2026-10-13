import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { enroll } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createTestClock } from '../helpers/test-app.ts';

// Datos inventados. INSERT/UPDATE directos con sentencias preparadas: la base se defiende aunque se salte la API.
const MIGRATION_004 = '004-add-job-enrollment-deadline.sql';
const CHECK_FAILED = /CHECK constraint failed/;
const CREATED_AT = '2026-10-01T08:00:00.000Z';
const PUBLISHED_AT = '2026-10-02T09:00:00.000Z';

const PREVIOUS_MIGRATIONS = [
  '001-create-job-openings.sql',
  '002-create-candidates.sql',
  '003-create-applications.sql',
];

let db: DatabaseSync;

/** Lee un fichero SQL de `src/db/` (la ruta es relativa a esa carpeta). */
function readSql(path: string): string {
  return readFileSync(new URL(`../../src/db/${path}`, import.meta.url), 'utf8');
}

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  if (db.isOpen) db.close(); // buildApp cierra la base al cerrar la app (EC-06)
});

function insertDraft(deadline: string | null): void {
  db.prepare(
    `INSERT INTO job_openings (title, status, created_at, enrollment_deadline)
     VALUES ('Analista de datos junior', 'draft', ?, ?)`,
  ).run(CREATED_AT, deadline);
}

function jobColumns(): { name: string; notnull: number; dflt_value: unknown }[] {
  return db.prepare('PRAGMA table_info(job_openings)').all() as unknown as {
    name: string;
    notnull: number;
    dflt_value: unknown;
  }[];
}

describe('migración 004-add-job-enrollment-deadline', () => {
  it('RF-01 migrate aplica la 004 y la columna enrollment_deadline es opcional', () => {
    expect(migrate(db)).toContain(MIGRATION_004);

    const registered = db.prepare('SELECT name FROM schema_migrations ORDER BY name').all();
    expect(registered.map((row) => row.name)).toContain(MIGRATION_004);
    const column = jobColumns().find((c) => c.name === 'enrollment_deadline');
    expect(column).toMatchObject({ notnull: 0, dflt_value: null });
    // Sin la columna en el INSERT, la oferta queda sin plazo.
    db.prepare(
      `INSERT INTO job_openings (title, status, created_at) VALUES ('Analista de datos', 'draft', ?)`,
    ).run(CREATED_AT);
    const row = db.prepare('SELECT enrollment_deadline AS d FROM job_openings').get();
    expect(row?.d).toBeNull();
    expect(migrate(db)).toEqual([]);
  });

  it('Migración CHECK: 2026-10-13 y 2028-02-29 pasan; 2026-02-31, 2026-13-01, 2027-02-29, 13/10/2026 y " 2026-10-13" abortan', () => {
    migrate(db);

    insertDraft('2026-10-13');
    insertDraft('2028-02-29');
    insertDraft(null);

    const invalid = ['2026-02-31', '2026-13-01', '2027-02-29', '13/10/2026', ' 2026-10-13'];
    for (const value of invalid) {
      expect(() => insertDraft(value), `INSERT ${value}`).toThrow(CHECK_FAILED);
    }
    for (const value of invalid) {
      expect(
        () => db.prepare('UPDATE job_openings SET enrollment_deadline = ? WHERE id = 1').run(value),
        `UPDATE ${value}`,
      ).toThrow(CHECK_FAILED);
    }
    const stored = db
      .prepare('SELECT enrollment_deadline AS d FROM job_openings ORDER BY id')
      .all();
    expect(stored.map((row) => row.d)).toEqual(['2026-10-13', '2028-02-29', null]);
  });

  it('EC-06 oferta previa a la migración: null, se publica y se inscribe', async () => {
    // Base «de antes»: schema.sql y 001-003 aplicadas a mano, con un borrador ya publicable.
    db.exec(readSql('schema.sql'));
    for (const name of PREVIOUS_MIGRATIONS) {
      db.exec(readSql(`migrations/${name}`));
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(name);
    }
    db.prepare(
      `INSERT INTO job_openings (title, description, location, work_mode, status, created_at)
       VALUES ('Técnica/o de selección', 'Descripción inventada.', 'Valencia', 'remota', 'draft', ?)`,
    ).run(CREATED_AT);

    expect(migrate(db)).toEqual([MIGRATION_004]);

    const clock = createTestClock(PUBLISHED_AT);
    const app = buildApp({ db, now: clock.now });
    try {
      const got = await app.inject({ method: 'GET', url: '/api/jobs/1' });
      expect(got.statusCode).toBe(200);
      expect(got.json<Job>().enrollmentDeadline).toBeNull();

      const published = await app.inject({ method: 'POST', url: '/api/jobs/1/publish' });
      expect(published.statusCode).toBe(200);
      expect(published.json<Job>()).toMatchObject({
        status: 'published',
        enrollmentDeadline: null,
      });

      const candidate = await createCandidate(app, {
        fullName: 'Ana Gil',
        email: 'ana.gil@example.com',
      });
      const enrolled = await enroll(app, 1, candidate.id);
      expect(enrolled.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });
});
