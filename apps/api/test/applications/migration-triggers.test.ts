import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';

// Datos inventados. Fixture: inscripción rejected con el cambio inicial NULL→received (id 1) y received→rejected
// con motivo y nota (id 2). El trigger BEFORE UPDATE/DELETE de stage_changes es la defensa de INV-03 (CA-27).
const AT = '2026-10-01T09:00:00.000Z';
const IMMUTABLE = /stage_changes es inmutable/;

let db: DatabaseSync;

function snapshot(): string {
  return JSON.stringify(db.prepare('SELECT * FROM stage_changes ORDER BY id').all());
}

function note(id: number): unknown {
  return db.prepare('SELECT note FROM stage_changes WHERE id = ?').get(id)?.note;
}

function expectAborts(sql: string): void {
  const before = snapshot();
  expect(() => db.exec(sql)).toThrow(IMMUTABLE);
  expect(snapshot()).toBe(before);
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

describe('triggers de stage_changes (INV-03)', () => {
  it('CA-27 UPDATE directo de to_stage y DELETE directo sobre stage_changes → abortan y la fila no cambia', () => {
    expectAborts("UPDATE stage_changes SET to_stage = 'screening', reason = NULL WHERE id = 2");
    expectAborts('DELETE FROM stage_changes WHERE id = 2');
  });

  it('EC-15 DELETE de cualquier fila, también del cambio inicial, aborta y no borra nada', () => {
    expectAborts('DELETE FROM stage_changes WHERE id = 1');
    expectAborts('DELETE FROM stage_changes');
  });
});

describe('excepción RGPD §5 (DD-04): solo vaciar la nota', () => {
  it('RGPD §5 SET note = NULL en un rejected con nota → se vacía y el resto de la fila no cambia', () => {
    const before = db.prepare('SELECT * FROM stage_changes WHERE id = 2').get();
    db.exec('UPDATE stage_changes SET note = NULL WHERE id = 2');
    expect(db.prepare('SELECT * FROM stage_changes WHERE id = 2').get()).toEqual({
      ...before,
      note: null,
    });
    expect(note(1)).toBeNull();
  });

  it('RGPD §5 repetir SET note = NULL con la nota ya NULL se acepta', () => {
    db.exec('UPDATE stage_changes SET note = NULL WHERE id = 2');
    const before = snapshot();
    db.exec('UPDATE stage_changes SET note = NULL WHERE id = 2');
    expect(snapshot()).toBe(before);
  });

  it('RGPD §5 SET note = NULL sobre el cambio inicial (NULL → received) se acepta', () => {
    const before = snapshot();
    db.exec('UPDATE stage_changes SET note = NULL WHERE id = 1');
    expect(snapshot()).toBe(before);
  });

  it('RGPD §5 note a otro texto → aborta y la fila no cambia', () => {
    expectAborts("UPDATE stage_changes SET note = 'otra nota' WHERE id = 2");
  });

  it('RGPD §5 note = NULL junto a otra columna → aborta y la fila no cambia', () => {
    expectAborts("UPDATE stage_changes SET note = NULL, reason = 'other' WHERE id = 2");
  });

  it.each<[string, string]>([
    ['id', 'id = 9'],
    ['application_id', 'application_id = 2'],
    ['from_stage', "from_stage = 'screening'"],
    ['to_stage', "to_stage = 'screening', reason = NULL"],
    ['changed_at', "changed_at = '2026-10-02T09:00:00.000Z'"],
    ['reason', "reason = 'other'"],
  ])('RGPD §5 UPDATE de %s → aborta y la fila no cambia', (_column, assignment) => {
    expectAborts(`UPDATE stage_changes SET ${assignment} WHERE id = 2`);
  });

  it('RGPD §5 reason a NULL en un rejected → aborta y la fila no cambia', () => {
    expectAborts('UPDATE stage_changes SET reason = NULL WHERE id = 2');
  });

  it('RGPD §5 cambiar from_stage del cambio inicial (NULL → received) → aborta y la fila no cambia', () => {
    expectAborts("UPDATE stage_changes SET from_stage = 'received' WHERE id = 1");
  });

  it('RGPD §5 DELETE sigue abortando también tras vaciar la nota', () => {
    db.exec('UPDATE stage_changes SET note = NULL WHERE id = 2');
    expectAborts('DELETE FROM stage_changes WHERE id = 2');
  });
});
