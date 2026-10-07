import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';

// T-05 / SEC-09: sin recursive_triggers, REPLACE (y INSERT OR REPLACE) borra la fila en conflicto sin disparar
// stage_changes_no_delete. Datos inventados. Fixture: inscripción rejected con los cambios 1 (NULL→received) y
// 2 (received→rejected con motivo y nota).
const AT = '2026-10-01T09:00:00.000Z';
const IMMUTABLE = /stage_changes es inmutable/;

let db: DatabaseSync;

function snapshot(table: string): string {
  return JSON.stringify(db.prepare(`SELECT * FROM ${table} ORDER BY id`).all());
}

function expectAborts(sql: string, table = 'stage_changes'): void {
  const before = snapshot(table);
  expect(() => db.exec(sql)).toThrow(IMMUTABLE);
  expect(snapshot(table)).toBe(before);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  db.prepare(
    `INSERT INTO job_openings (title, description, location, work_mode, status, created_at, published_at)
     VALUES ('Analista de datos', 'Descripción inventada.', 'Valencia', 'remota', 'published', ?, ?)`,
  ).run(AT, AT);
  db.prepare(
    `INSERT INTO candidates (full_name, email, created_at) VALUES ('Lucía Ferrer Soto', 'lucia.ferrer@example.com', ?)`,
  ).run(AT);
  db.prepare(
    `INSERT INTO applications (candidate_id, job_id, stage, created_at, last_change_at)
     VALUES (1, 1, 'rejected', ?, ?)`,
  ).run(AT, AT);
  db.prepare(
    `INSERT INTO stage_changes (application_id, from_stage, to_stage, changed_at) VALUES (1, NULL, 'received', ?)`,
  ).run(AT);
  db.prepare(
    `INSERT INTO stage_changes (application_id, from_stage, to_stage, changed_at, reason, note)
     VALUES (1, 'received', 'rejected', ?, 'not_a_fit', 'Nota inventada sin datos sensibles.')`,
  ).run(AT);
});

afterEach(() => {
  db.close();
});

describe('recursive_triggers y REPLACE sobre stage_changes (SEC-09, INV-03)', () => {
  it('SEC-09 la conexión abre con recursive_triggers = 1', () => {
    expect(db.prepare('PRAGMA recursive_triggers').get()).toEqual({ recursive_triggers: 1 });
  });

  it('SEC-09 INSERT OR REPLACE con el id de un StageChange existente → aborta y la fila no cambia', () => {
    expectAborts(
      `INSERT OR REPLACE INTO stage_changes (id, application_id, from_stage, to_stage, changed_at, reason, note)
       VALUES (2, 1, 'received', 'rejected', '2026-10-02T09:00:00.000Z', 'other', NULL)`,
    );
  });

  it('SEC-09 REPLACE INTO con el id de un StageChange existente → aborta y la fila no cambia', () => {
    expectAborts(
      `REPLACE INTO stage_changes (id, application_id, from_stage, to_stage, changed_at, reason, note)
       VALUES (2, 1, 'received', 'rejected', '2026-10-02T09:00:00.000Z', 'other', NULL)`,
    );
  });

  it('SEC-09 REPLACE sobre el cambio inicial (NULL → received) → aborta y la fila no cambia', () => {
    expectAborts(
      `REPLACE INTO stage_changes (id, application_id, from_stage, to_stage, changed_at)
       VALUES (1, 1, NULL, 'received', '2026-10-02T09:00:00.000Z')`,
    );
  });

  it('SEC-09 REPLACE que choca con un índice único (otro id, misma inscripción) → aborta y no borra nada', () => {
    expectAborts(
      `INSERT OR REPLACE INTO stage_changes (id, application_id, from_stage, to_stage, changed_at, reason)
       VALUES (9, 1, 'received', 'rejected', '2026-10-02T09:00:00.000Z', 'other')`,
    );
  });
});
