import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { seed } from '../../src/db/seed.ts';

// Datos inventados. El plazo del seed es relativo al día de Madrid de `now` (DD-11).
const BACKEND = 'Desarrollador/a backend (Node.js)';
const ACCOUNTING = 'Administrativo/a contable';

let db: DatabaseSync | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function seeded(now: Date): DatabaseSync {
  db = openDatabase(':memory:');
  migrate(db);
  seed(db, now);
  return db;
}

function deadlines(database: DatabaseSync): Record<string, string | null> {
  const rows = database
    .prepare('SELECT title, enrollment_deadline FROM job_openings ORDER BY id')
    .all();
  return Object.fromEntries(
    rows.map((row) => [String(row.title), (row.enrollment_deadline as string | null) ?? null]),
  );
}

function applicationsAfter(database: DatabaseSync, title: string, deadline: string): number {
  const row = database
    .prepare(
      `SELECT COUNT(*) AS total FROM applications a JOIN job_openings j ON j.id = a.job_id
       WHERE j.title = ? AND a.created_at >= date(?, '+1 day')`,
    )
    .get(title, deadline);
  return Number(row?.total);
}

function applicationsOf(database: DatabaseSync, title: string): number {
  const row = database
    .prepare(
      `SELECT COUNT(*) AS total FROM applications a JOIN job_openings j ON j.id = a.job_id
       WHERE j.title = ?`,
    )
    .get(title);
  return Number(row?.total);
}

describe('seed — plazos de inscripción (RF-05)', () => {
  it.each([
    { now: '2026-10-13T10:00:00.000Z', future: '2026-10-27', past: '2026-10-10' },
    { now: '2026-12-30T10:00:00.000Z', future: '2027-01-13', past: '2026-12-27' },
  ])(
    'CA-13 seed($now): una publicada con plazo NOW+14 ($future) y otra con NOW−3 ($past), sin inscripciones posteriores al plazo',
    ({ now, future, past }) => {
      const database = seeded(new Date(now));

      const byTitle = deadlines(database);

      expect(byTitle[BACKEND]).toBe(future);
      expect(byTitle[ACCOUNTING]).toBe(past);
      const others = Object.entries(byTitle).filter(
        ([title]) => ![BACKEND, ACCOUNTING].includes(title),
      );
      expect(others).toHaveLength(8);
      expect(others.every(([, deadline]) => deadline === null)).toBe(true);
      expect(applicationsAfter(database, BACKEND, future)).toBe(0);
      expect(applicationsOf(database, BACKEND)).toBe(10);
      expect(applicationsOf(database, ACCOUNTING)).toBe(0);
    },
  );

  it('CA-13 el día de Madrid manda: 23:30 UTC del 13 de octubre ya es el 14 en Madrid', () => {
    const database = seeded(new Date('2026-10-13T22:30:00.000Z'));

    const byTitle = deadlines(database);

    expect(byTitle[BACKEND]).toBe('2026-10-28');
    expect(byTitle[ACCOUNTING]).toBe('2026-10-11');
  });
});
