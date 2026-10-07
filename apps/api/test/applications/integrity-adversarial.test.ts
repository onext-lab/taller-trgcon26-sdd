import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { seed } from '../../src/db/seed.ts';

// TASK-09 [adversarial] (EC-14, EC-15, INV-04, INV-07, INV-10, RF-11): la base se defiende sola, saltándose el
// servicio con INSERT y DELETE directos. Datos inventados. No repite EC-12, EC-13 ni los triggers (migration*.test.ts).
const AT = '2026-10-01T09:00:00.000Z';
const NOW = new Date('2026-10-06T10:00:00.000Z');
const CHECK = /CHECK constraint failed/;
const UNIQUE = /UNIQUE constraint failed/;
const FOREIGN_KEY = /FOREIGN KEY constraint failed/;

let db: DatabaseSync;

beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
});

afterEach(() => {
  db.close();
});

function count(table: string): number {
  return Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n);
}

function indexSql(name: string): string {
  return String(db.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(name)?.sql);
}

function insertJob(): number {
  const result = db
    .prepare(
      `INSERT INTO job_openings (title, description, location, work_mode, status, created_at, published_at)
       VALUES ('Analista de datos', 'Descripción inventada.', 'Valencia', 'remota', 'published', ?, ?)`,
    )
    .run(AT, AT);
  return Number(result.lastInsertRowid);
}

function insertCandidate(email: string): number {
  const result = db
    .prepare(
      `INSERT INTO candidates (full_name, email, created_at) VALUES ('Lucía Ferrer Soto', ?, ?)`,
    )
    .run(email, AT);
  return Number(result.lastInsertRowid);
}

function insertApplication(jobId: number, candidateId: number, stage = 'received'): number {
  const result = db
    .prepare(
      `INSERT INTO applications (candidate_id, job_id, stage, created_at, last_change_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(candidateId, jobId, stage, AT, AT);
  return Number(result.lastInsertRowid);
}

interface Change {
  from: string | null;
  to: string;
  reason?: string | null;
  note?: string | null;
}

function insertChange(applicationId: number, { from, to, reason = null, note = null }: Change) {
  return db
    .prepare(
      `INSERT INTO stage_changes (application_id, from_stage, to_stage, changed_at, reason, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(applicationId, from, to, AT, reason, note);
}

function fixture(): { jobId: number; candidateId: number; applicationId: number } {
  const jobId = insertJob();
  const candidateId = insertCandidate('lucia.ferrer@example.com');
  return { jobId, candidateId, applicationId: insertApplication(jobId, candidateId) };
}

describe('EC-14 unicidad de la pareja (candidato, oferta)', () => {
  it('EC-14 segundo INSERT directo de la misma pareja → falla el índice único y queda 1 fila', () => {
    const { jobId, candidateId } = fixture();

    expect(() => insertApplication(jobId, candidateId, 'screening')).toThrow(UNIQUE);

    expect(count('applications')).toBe(1);
    expect(indexSql('applications_candidate_job_uq')).toContain('UNIQUE');
  });
});

describe('EC-15 integridad referencial (FK RESTRICT)', () => {
  it('EC-15 la conexión tiene las claves foráneas activas', () => {
    expect(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys).toBe(1);
  });

  it('EC-15 DELETE de un candidato con inscripciones → falla la FK y las filas siguen', () => {
    const { candidateId } = fixture();

    expect(() => db.prepare('DELETE FROM candidates WHERE id = ?').run(candidateId)).toThrow(
      FOREIGN_KEY,
    );

    expect(count('candidates')).toBe(1);
    expect(count('applications')).toBe(1);
  });

  it('EC-15 DELETE de una oferta con inscripciones → falla la FK y las filas siguen', () => {
    const { jobId } = fixture();

    expect(() => db.prepare('DELETE FROM job_openings WHERE id = ?').run(jobId)).toThrow(
      FOREIGN_KEY,
    );

    expect(count('job_openings')).toBe(1);
    expect(count('applications')).toBe(1);
  });

  it('EC-15 DELETE de una inscripción con historial → falla la FK y el historial sigue', () => {
    const { applicationId } = fixture();
    insertChange(applicationId, { from: null, to: 'received' });

    expect(() => db.prepare('DELETE FROM applications WHERE id = ?').run(applicationId)).toThrow(
      FOREIGN_KEY,
    );

    expect(count('applications')).toBe(1);
    expect(count('stage_changes')).toBe(1);
  });

  it('EC-15 INSERT con candidato, oferta o inscripción inexistentes → falla la FK', () => {
    const { jobId, candidateId } = fixture();

    expect(() => insertApplication(jobId, candidateId + 99)).toThrow(FOREIGN_KEY);
    expect(() => insertApplication(jobId + 99, candidateId)).toThrow(FOREIGN_KEY);
    expect(() => insertChange(9999, { from: null, to: 'received' })).toThrow(FOREIGN_KEY);
    expect(count('applications')).toBe(1);
    expect(count('stage_changes')).toBe(0);
  });
});

describe('INV-04 tabla de transiciones e índices únicos del historial', () => {
  it('INV-04 un salto (received → interview) falla', () => {
    const { applicationId } = fixture();
    expect(() => insertChange(applicationId, { from: 'received', to: 'interview' })).toThrow(CHECK);
    expect(count('stage_changes')).toBe(0);
  });

  it('INV-04 un retroceso (screening → received) falla', () => {
    const { applicationId } = fixture();
    expect(() => insertChange(applicationId, { from: 'screening', to: 'received' })).toThrow(CHECK);
    expect(count('stage_changes')).toBe(0);
  });

  it('INV-04 una salida de etapa final (hired → rejected) falla, y también la de rejected', () => {
    const { applicationId } = fixture();
    expect(() =>
      insertChange(applicationId, { from: 'hired', to: 'rejected', reason: 'other' }),
    ).toThrow(CHECK);
    expect(() => insertChange(applicationId, { from: 'rejected', to: 'screening' })).toThrow(CHECK);
    expect(count('stage_changes')).toBe(0);
  });

  it('INV-04 stage_changes_one_initial_uq: un segundo cambio inicial falla', () => {
    const { applicationId } = fixture();
    insertChange(applicationId, { from: null, to: 'received' });

    expect(() => insertChange(applicationId, { from: null, to: 'received' })).toThrow(UNIQUE);

    expect(count('stage_changes')).toBe(1);
    expect(indexSql('stage_changes_one_initial_uq')).toMatch(/UNIQUE.*from_stage IS NULL/s);
  });

  it('INV-04 stage_changes_one_final_uq: un segundo cambio final falla', () => {
    const { applicationId } = fixture();
    insertChange(applicationId, { from: 'received', to: 'rejected', reason: 'not_a_fit' });

    expect(() =>
      insertChange(applicationId, { from: 'screening', to: 'rejected', reason: 'other' }),
    ).toThrow(UNIQUE);

    expect(count('stage_changes')).toBe(1);
    expect(indexSql('stage_changes_one_final_uq')).toMatch(/UNIQUE.*hired.*rejected/s);
  });
});

describe('INV-07 e INV-10 motivo y nota', () => {
  it('INV-07 un rejected sin motivo, o un motivo fuera de rejected o inventado, fallan', () => {
    const { applicationId } = fixture();

    expect(() => insertChange(applicationId, { from: 'received', to: 'rejected' })).toThrow(CHECK);
    expect(() =>
      insertChange(applicationId, { from: 'received', to: 'screening', reason: 'not_a_fit' }),
    ).toThrow(CHECK);
    expect(() =>
      insertChange(applicationId, { from: 'received', to: 'rejected', reason: 'inventado' }),
    ).toThrow(CHECK);
    expect(count('stage_changes')).toBe(0);
  });

  it('INV-10 una nota vacía («») falla, también en un rejected con motivo', () => {
    const { applicationId } = fixture();
    const change = { from: 'received', to: 'rejected', reason: 'other', note: '' };

    expect(() => insertChange(applicationId, change)).toThrow(CHECK);
    expect(count('stage_changes')).toBe(0);
  });

  it('INV-10 una nota en un destino no rejected falla', () => {
    const { applicationId } = fixture();

    expect(() =>
      insertChange(applicationId, { from: 'received', to: 'screening', note: 'Nota inventada' }),
    ).toThrow(CHECK);
    expect(() =>
      insertChange(applicationId, { from: null, to: 'received', note: 'Otra nota' }),
    ).toThrow(CHECK);
    expect(count('stage_changes')).toBe(0);
  });

  it('INV-10 un rejected con motivo y nota de 500 caracteres se acepta; 501 falla', () => {
    const { applicationId } = fixture();
    const reason = 'other';
    insertChange(applicationId, {
      from: 'received',
      to: 'rejected',
      reason,
      note: 'n'.repeat(500),
    });
    const second = insertApplication(insertJob(), insertCandidate('segundo@example.com'));

    expect(() =>
      insertChange(second, { from: 'received', to: 'rejected', reason, note: 'n'.repeat(501) }),
    ).toThrow(CHECK);
    expect(count('stage_changes')).toBe(1);
  });
});

describe('RF-11 sobre la base sembrada (seed)', () => {
  let initialChanges = 0;

  beforeEach(() => {
    seed(db, NOW);
    initialChanges = count('stage_changes');
  });

  function firstApplicationIn(stage: string): number {
    const row = db
      .prepare('SELECT id FROM applications WHERE stage = ? ORDER BY id LIMIT 1')
      .get(stage);
    return Number(row?.id);
  }

  function expectCountsUntouched(): void {
    expect(count('applications')).toBe(40);
    expect(count('stage_changes')).toBe(initialChanges);
  }

  it('RF-11 un INSERT directo que viola INV-04 (salto o retroceso) en una inscripción del seed falla', () => {
    const applicationId = firstApplicationIn('screening');

    expect(() => insertChange(applicationId, { from: 'screening', to: 'offer' })).toThrow(CHECK);
    expect(() => insertChange(applicationId, { from: 'screening', to: 'received' })).toThrow(CHECK);
    expectCountsUntouched();
  });

  it('RF-11 un INSERT directo que viola INV-04 (segundo final o salida de final) en un rejected del seed falla', () => {
    const applicationId = firstApplicationIn('rejected');

    expect(() =>
      insertChange(applicationId, { from: 'received', to: 'rejected', reason: 'other' }),
    ).toThrow(UNIQUE);
    expect(() => insertChange(applicationId, { from: 'rejected', to: 'screening' })).toThrow(CHECK);
    expectCountsUntouched();
  });

  it('RF-11 un INSERT directo que viola INV-07 (rejected sin motivo, motivo fuera de rejected) falla', () => {
    const applicationId = firstApplicationIn('interview');

    expect(() => insertChange(applicationId, { from: 'interview', to: 'rejected' })).toThrow(CHECK);
    expect(() =>
      insertChange(applicationId, { from: 'interview', to: 'offer', reason: 'other' }),
    ).toThrow(CHECK);
    expectCountsUntouched();
  });

  it('RF-11 repetir la pareja de una inscripción del seed falla y los recuentos siguen en 40', () => {
    const row = db
      .prepare('SELECT candidate_id, job_id FROM applications ORDER BY id LIMIT 1')
      .get();

    expect(() => insertApplication(Number(row?.job_id), Number(row?.candidate_id))).toThrow(UNIQUE);
    expectCountsUntouched();
  });
});
