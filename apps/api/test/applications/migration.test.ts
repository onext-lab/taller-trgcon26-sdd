import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';

// Datos inventados. INSERT directos con sentencias preparadas: la base se defiende aunque se salte la API.
const AT = '2026-10-01T09:00:00.000Z';
const CHECK_FAILED = /CHECK constraint failed/;

let db: DatabaseSync;

function names(type: 'table' | 'index' | 'trigger', table?: string): string[] {
  const rows = table
    ? db
        .prepare('SELECT name FROM sqlite_master WHERE type = ? AND tbl_name = ? ORDER BY name')
        .all(type, table)
    : db.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').all(type);
  return rows.map((row) => String(row.name));
}

function seedApplication(): void {
  db.prepare(
    `INSERT INTO job_openings (title, description, location, work_mode, status, created_at, published_at)
     VALUES ('Analista de datos', 'Descripción inventada.', 'Valencia', 'remota', 'published', ?, ?)`,
  ).run(AT, AT);
  db.prepare(
    `INSERT INTO candidates (full_name, email, created_at) VALUES ('Lucía Ferrer Soto', 'lucia.ferrer@example.com', ?)`,
  ).run(AT);
  db.prepare(
    `INSERT INTO applications (candidate_id, job_id, stage, created_at, last_change_at)
     VALUES (1, 1, 'received', ?, ?)`,
  ).run(AT, AT);
}

function insertChange(
  from: SQLInputValue,
  to: SQLInputValue,
  reason: SQLInputValue = null,
  note: SQLInputValue = null,
) {
  db.prepare(
    `INSERT INTO stage_changes (application_id, from_stage, to_stage, changed_at, reason, note)
     VALUES (1, ?, ?, ?, ?, ?)`,
  ).run(from, to, AT, reason, note);
}

function countChanges(): number {
  return Number(db.prepare('SELECT COUNT(*) AS total FROM stage_changes').get()?.total);
}

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('migración 003-create-applications', () => {
  it('RF-02 migrate aplica 001, 002 y 003 sobre :memory:, las registra y crea tablas, índices y los 2 triggers', () => {
    expect(migrate(db)).toEqual([
      '001-create-job-openings.sql',
      '002-create-candidates.sql',
      '003-create-applications.sql',
    ]);
    const registered = db.prepare('SELECT name FROM schema_migrations ORDER BY name').all();
    expect(registered.map((row) => row.name)).toContain('003-create-applications.sql');
    expect(names('table')).toEqual(expect.arrayContaining(['applications', 'stage_changes']));
    const indexes = [...names('index', 'applications'), ...names('index', 'stage_changes')].filter(
      (name) => !name.startsWith('sqlite_autoindex'),
    );
    expect(indexes.sort()).toEqual([
      'applications_candidate_job_uq',
      'applications_job_pipeline_idx',
      'stage_changes_application_idx',
      'stage_changes_one_final_uq',
      'stage_changes_one_initial_uq',
    ]);
    expect(names('trigger')).toEqual(['stage_changes_no_delete', 'stage_changes_no_update']);
  });

  it('EC-16 un segundo migrate devuelve []', () => {
    migrate(db);
    expect(migrate(db)).toEqual([]);
  });

  it('EC-12 etapa `foo`, motivo en un `screening` y nota de 501 caracteres → error de CHECK', () => {
    migrate(db);
    seedApplication();
    expect(() =>
      db
        .prepare(
          `INSERT INTO applications (candidate_id, job_id, stage, created_at, last_change_at)
           VALUES (1, 1, 'foo', ?, ?)`,
        )
        .run(AT, AT),
    ).toThrow(CHECK_FAILED);
    expect(() => insertChange('received', 'screening', 'other')).toThrow(CHECK_FAILED);
    expect(() => insertChange('received', 'rejected', 'other', 'n'.repeat(501))).toThrow(
      CHECK_FAILED,
    );
    expect(countChanges()).toBe(0);
  });

  it('EC-13 (NULL, received) se acepta; (NULL, screening) falla el CHECK', () => {
    migrate(db);
    seedApplication();
    expect(() => insertChange('screening', 'screening')).toThrow(CHECK_FAILED);
    expect(() => insertChange(null, 'screening')).toThrow(CHECK_FAILED);
    expect(countChanges()).toBe(0);
    insertChange(null, 'received');
    expect(countChanges()).toBe(1);
  });
});
