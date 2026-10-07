import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { SEED_NOTES } from '../../src/db/seed-applications.ts';
import { seed } from '../../src/db/seed.ts';
import type { Pipeline } from '../../src/modules/applications/schemas.ts';

// Datos inventados. `now` fijo: las inscripciones de las ofertas publicadas son relativas al reset (DD-10).
const NOW = new Date('2026-10-06T10:00:00.000Z');
const PHONE = /^(?:\+34 |\(34\) )?600 000 0\d\d$/;
const EMPTY_STAGES = { received: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0 };

let db: DatabaseSync;

function freshSeededDatabase(): DatabaseSync {
  const database = openDatabase(':memory:');
  migrate(database);
  seed(database, NOW);
  return database;
}

beforeEach(() => {
  db = freshSeededDatabase();
});

afterEach(() => {
  db.close();
});

/** IDs de las ofertas en el orden de `SEED_JOBS` (los IDs se asignan al insertar). */
function jobIds(database: DatabaseSync): number[] {
  return database
    .prepare('SELECT id FROM job_openings ORDER BY id')
    .all()
    .map((row) => Number(row.id));
}

/** IDs de los candidatos: la posición `i` es la de `SEED_CANDIDATES`. */
function candidateIds(database: DatabaseSync): number[] {
  return database
    .prepare('SELECT id FROM candidates ORDER BY id')
    .all()
    .map((row) => Number(row.id));
}

function count(database: DatabaseSync, sql: string, ...params: number[]): number {
  return Number(database.prepare(sql).get(...params)?.n);
}

/** Recuento de inscripciones por etapa de una oferta (las seis etapas, con 0 si no hay). */
function stageCounts(database: DatabaseSync, jobId: number): Record<string, number> {
  const rows = database
    .prepare('SELECT stage, COUNT(*) AS n FROM applications WHERE job_id = ? GROUP BY stage')
    .all(jobId);
  const counts: Record<string, number> = { ...EMPTY_STAGES };
  for (const row of rows) counts[String(row.stage)] = Number(row.n);
  return counts;
}

/** Rechazos de una oferta: recuento por motivo y número de notas escritas. */
function rejections(database: DatabaseSync, jobId: number) {
  const rows = database
    .prepare(
      `SELECT sc.reason, sc.note FROM stage_changes sc
       JOIN applications a ON a.id = sc.application_id
       WHERE a.job_id = ? AND sc.to_stage = 'rejected'`,
    )
    .all(jobId);
  const reasons: Record<string, number> = {};
  for (const row of rows) reasons[String(row.reason)] = (reasons[String(row.reason)] ?? 0) + 1;
  return { reasons, notes: rows.filter((row) => row.note !== null).length };
}

const EXPECTED_BY_POSITION = [
  {
    position: 4,
    total: 10,
    stages: { received: 3, screening: 2, interview: 2, offer: 1, hired: 1, rejected: 1 },
    reasons: { not_a_fit: 1 },
    notes: 1,
  },
  {
    position: 6,
    total: 10,
    stages: { received: 2, screening: 2, interview: 1, offer: 1, hired: 1, rejected: 3 },
    reasons: { candidate_withdrew: 1, other: 1, not_a_fit: 1 },
    notes: 1,
  },
  {
    position: 7,
    total: 10,
    stages: { received: 2, screening: 2, interview: 2, offer: 2, hired: 0, rejected: 2 },
    reasons: { other: 1, candidate_withdrew: 1 },
    notes: 0,
  },
  {
    position: 8,
    total: 5,
    stages: { received: 0, screening: 0, interview: 0, offer: 0, hired: 1, rejected: 4 },
    reasons: { not_a_fit: 1, job_closed: 3 },
    notes: 0,
  },
  {
    position: 9,
    total: 5,
    stages: { received: 0, screening: 0, interview: 0, offer: 0, hired: 1, rejected: 4 },
    reasons: { other: 1, job_closed: 3 },
    notes: 0,
  },
];

describe('seed de inscripciones — composición (CA-25, RF-11)', () => {
  it.each(EXPECTED_BY_POSITION)(
    'CA-25 la oferta $position tiene la composición de DT-05 (total, etapas y motivos)',
    ({ position, total, stages, reasons, notes }) => {
      const jobId = jobIds(db)[position]!;

      expect(count(db, 'SELECT COUNT(*) AS n FROM applications WHERE job_id = ?', jobId)).toBe(
        total,
      );
      expect(stageCounts(db, jobId)).toEqual(stages);
      expect(rejections(db, jobId)).toEqual({ reasons, notes });
    },
  );

  it('CA-25 40 inscripciones en total, ninguna en los borradores (0-3) ni en la posición 5', () => {
    expect(count(db, 'SELECT COUNT(*) AS n FROM applications')).toBe(40);
    const ids = jobIds(db);
    for (const position of [0, 1, 2, 3, 5]) {
      expect(
        count(db, 'SELECT COUNT(*) AS n FROM applications WHERE job_id = ?', ids[position]!),
      ).toBe(0);
    }
    const perJob = EXPECTED_BY_POSITION.reduce((sum, { total }) => sum + total, 0);
    expect(perJob).toBe(40);
  });

  it('CA-25 cada inscripción tiene su historial: un StageChange por etapa recorrida, 1 a 5', () => {
    const total = count(db, 'SELECT COUNT(*) AS n FROM stage_changes');
    const initial = count(db, 'SELECT COUNT(*) AS n FROM stage_changes WHERE from_stage IS NULL');
    const perApplication = db
      .prepare('SELECT COUNT(*) AS n FROM stage_changes GROUP BY application_id')
      .all()
      .map((row) => Number(row.n));

    expect(initial).toBe(40);
    expect(perApplication).toHaveLength(40);
    expect(Math.min(...perApplication)).toBe(1);
    expect(Math.max(...perApplication)).toBeLessThanOrEqual(5);
    expect(total).toBeGreaterThan(40);
  });
});

describe('seed de inscripciones — estados (EC-54)', () => {
  it('EC-54 las 6 etapas están en las publicadas y la publicada de la posición 5 está vacía', async () => {
    const published = jobIds(db).filter((_, position) => [4, 6, 7].includes(position));
    const present = new Set<string>();
    for (const jobId of published) {
      for (const [stage, n] of Object.entries(stageCounts(db, jobId)))
        if (n > 0) present.add(stage);
    }
    expect([...present].sort()).toEqual(
      ['hired', 'interview', 'offer', 'received', 'rejected', 'screening'].sort(),
    );

    const appDb = freshSeededDatabase();
    const app = buildApp({ db: appDb, now: () => NOW });
    try {
      const emptyJob = jobIds(appDb)[5]!;
      const empty = await app.inject({ method: 'GET', url: `/api/jobs/${emptyJob}/applications` });
      expect(empty.statusCode).toBe(200);
      expect(empty.json<Pipeline>()).toEqual({
        job: { id: emptyJob, status: 'published' },
        items: [],
      });
      const fullJob = jobIds(appDb)[4]!;
      const full = await app.inject({ method: 'GET', url: `/api/jobs/${fullJob}/applications` });
      expect(full.json<Pipeline>().items).toHaveLength(10);
    } finally {
      await app.close();
    }
  });
});

describe('seed de inscripciones — candidatos (EC-55)', () => {
  it('EC-54/RF-11 reparto de candidatos: 10 con dos inscripciones publicadas (≥ 3 con dos abiertas) y 25-29 en las dos cerradas', () => {
    const ids = candidateIds(db);
    const jobs = jobIds(db);
    const inPublished = db
      .prepare(
        `SELECT candidate_id, COUNT(*) AS n, SUM(stage NOT IN ('hired', 'rejected')) AS open
         FROM applications WHERE job_id IN (?, ?, ?) GROUP BY candidate_id`,
      )
      .all(jobs[4]!, jobs[6]!, jobs[7]!);
    const two = inPublished.filter((row) => Number(row.n) === 2);

    expect(inPublished).toHaveLength(20);
    expect(two).toHaveLength(10);
    expect(two.filter((row) => Number(row.open) === 2).length).toBeGreaterThanOrEqual(3);
    for (const row of inPublished) {
      expect(ids.slice(1, 21)).toContain(Number(row.candidate_id));
    }
    for (const position of [25, 26, 27, 28, 29]) {
      const closed = db
        .prepare('SELECT job_id FROM applications WHERE candidate_id = ? ORDER BY job_id')
        .all(ids[position]!)
        .map((row) => Number(row.job_id));
      expect(closed).toEqual([jobs[8], jobs[9]]);
    }
    for (const position of [0, 21, 22, 23, 24]) {
      expect(
        count(db, 'SELECT COUNT(*) AS n FROM applications WHERE candidate_id = ?', ids[position]!),
      ).toBe(0);
    }
  });
});

describe('seed de inscripciones — datos inventados (EC-56)', () => {
  it('EC-56 notas de la lista del seed, candidatos @example.com y teléfonos +34 600 000 0xx', () => {
    const notes = db
      .prepare('SELECT note FROM stage_changes WHERE note IS NOT NULL')
      .all()
      .map((row) => String(row.note));
    expect(notes).toHaveLength(2);
    for (const note of notes) expect(SEED_NOTES).toContain(note);

    const enrolled = db
      .prepare(
        'SELECT email, phone FROM candidates WHERE id IN (SELECT candidate_id FROM applications)',
      )
      .all();
    expect(enrolled).toHaveLength(25);
    for (const { email, phone } of enrolled) {
      expect(String(email)).toMatch(/@example\.com$/);
      if (phone !== null) expect(String(phone)).toMatch(PHONE);
    }
  });
});

/** Huella de las inscripciones y su historial por posición de oferta y de candidato (sin IDs de fila). */
function signature(database: DatabaseSync): string[] {
  const jobs = jobIds(database);
  const candidates = candidateIds(database);
  return database
    .prepare(
      `SELECT a.job_id, a.candidate_id, a.stage, a.created_at, a.last_change_at,
         group_concat(sc.to_stage || '@' || sc.changed_at || '/' || COALESCE(sc.reason, '-') || '/' || COALESCE(sc.note, '-'), ';') AS history
       FROM applications a JOIN stage_changes sc ON sc.application_id = a.id
       GROUP BY a.id ORDER BY a.id`,
    )
    .all()
    .map(
      (row) =>
        `${jobs.indexOf(Number(row.job_id))}|${candidates.indexOf(Number(row.candidate_id))}|` +
        `${String(row.stage)}|${String(row.created_at)}|${String(row.last_change_at)}|${String(row.history)}`,
    );
}

describe('seed de inscripciones — determinismo (EC-57)', () => {
  it('EC-57 dos bases nuevas con migrate + seed(NOW) dan los mismos recuentos e invariantes', () => {
    const other = freshSeededDatabase();
    try {
      for (const table of ['applications', 'stage_changes', 'candidates', 'job_openings']) {
        const sql = `SELECT COUNT(*) AS n FROM ${table}`;
        expect(count(other, sql)).toBe(count(db, sql));
      }
      expect(count(other, 'SELECT COUNT(*) AS n FROM applications')).toBe(40);
      expect(signature(other)).toEqual(signature(db));
      expect(
        count(other, 'SELECT COUNT(*) AS n FROM candidates WHERE retention_ends_at IS NULL'),
      ).toBe(count(db, 'SELECT COUNT(*) AS n FROM candidates WHERE retention_ends_at IS NULL'));
    } finally {
      other.close();
    }
  });
});
