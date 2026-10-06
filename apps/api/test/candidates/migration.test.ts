import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';

// Datos inventados. INSERT directos con sentencias preparadas: la base se defiende aunque se salte la API.
interface CandidateRow {
  full_name: SQLInputValue;
  email: SQLInputValue;
  phone: SQLInputValue;
  summary: SQLInputValue;
  skills: SQLInputValue;
  created_at: SQLInputValue;
  consent_given_at: SQLInputValue;
  consent_withdrawn_at: SQLInputValue;
  consent_version: SQLInputValue;
  retention_ends_at: SQLInputValue;
}

const GIVEN_AT = '2026-09-22T09:00:00.000Z';
const VALID: CandidateRow = {
  full_name: 'Lucía Ferrer Soto',
  email: 'lucia.ferrer@example.com',
  phone: '600000012',
  summary: 'Resumen inventado del perfil.',
  skills: '["sql","typescript"]',
  created_at: '2026-09-21T08:00:00.000Z',
  consent_given_at: null,
  consent_withdrawn_at: null,
  consent_version: null,
  retention_ends_at: '2027-03-21',
};

const CHECK_FAILED = /CHECK constraint failed/;

let db: DatabaseSync;

function insertCandidate(overrides: Partial<CandidateRow> = {}): void {
  const row = { ...VALID, ...overrides };
  db.prepare(
    `INSERT INTO candidates
       (full_name, email, phone, summary, skills, created_at, consent_given_at, consent_withdrawn_at,
        consent_version, retention_ends_at)
     VALUES
       (:full_name, :email, :phone, :summary, :skills, :created_at, :consent_given_at, :consent_withdrawn_at,
        :consent_version, :retention_ends_at)`,
  ).run({ ...row });
}

function countCandidates(): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM candidates').get();
  return Number(row?.total);
}

function expectRejected(overrides: Partial<CandidateRow>): void {
  expect(() => insertCandidate(overrides)).toThrow(CHECK_FAILED);
  expect(countCandidates()).toBe(0);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
});

afterEach(() => {
  db.close();
});

describe('migración 002-create-candidates', () => {
  it('RF-07 migrate aplica 001 y 002 sobre :memory:, las registra y crea los dos índices', () => {
    const fresh = openDatabase(':memory:');
    try {
      expect(migrate(fresh)).toEqual(['001-create-job-openings.sql', '002-create-candidates.sql']);
      const indexes = fresh
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'candidates'")
        .all()
        .map((row) => row.name);
      expect(indexes).toContain('candidates_email_uq');
      expect(indexes).toContain('candidates_created_at_idx');
      expect(migrate(fresh)).toEqual([]);
    } finally {
      fresh.close();
    }
  });

  it('acepta un candidato válido y uno mínimo, en las fronteras de longitud', () => {
    insertCandidate();
    insertCandidate({
      full_name: 'Al',
      email: 'a@b',
      phone: null,
      summary: null,
      skills: '[]',
      retention_ends_at: null,
    });
    insertCandidate({
      full_name: 'n'.repeat(100),
      email: `${'e'.repeat(242)}@example.com`,
      phone: '1'.repeat(21),
      summary: 's'.repeat(2000),
      skills: JSON.stringify(Array.from({ length: 20 }, (_, i) => `skill-${i}`)),
    });
    expect(countCandidates()).toBe(3);
    const first = db.prepare('SELECT * FROM candidates ORDER BY id LIMIT 1').get();
    expect(first).toMatchObject({
      id: 1,
      email: 'lucia.ferrer@example.com',
      consent_version: null,
    });
  });

  it('skills toma "[]" por defecto', () => {
    db.prepare('INSERT INTO candidates (full_name, email, created_at) VALUES (?, ?, ?)').run(
      'Mario Vidal',
      'mario.vidal@example.com',
      VALID.created_at as string,
    );
    expect(db.prepare('SELECT skills FROM candidates').get()?.skills).toBe('[]');
  });
});

describe('INV-02 email normalizado (EC-16)', () => {
  it.each<[string, string]>([
    ['en mayúsculas', 'Lucia.Ferrer@example.com'],
    ['con espacio al principio', ' lucia.ferrer@example.com'],
    ['con espacio al final', 'lucia.ferrer@example.com '],
    ['de 2 caracteres', 'a@'],
    ['de 255 caracteres', `${'e'.repeat(243)}@example.com`],
  ])('EC-16 la base rechaza un email %s', (_case, email) => {
    expectRejected({ email });
  });
});

describe('INV-04 coherencia del consentimiento (EC-16, EC-47)', () => {
  it('EC-16 rechaza una versión sin fecha de otorgamiento', () => {
    expectRejected({ consent_version: 'v1' });
  });

  it('EC-16 rechaza una fecha de otorgamiento sin versión', () => {
    expectRejected({ consent_given_at: GIVEN_AT });
  });

  it('EC-47 rechaza una fecha de retirada sin otorgamiento', () => {
    expectRejected({ consent_withdrawn_at: GIVEN_AT });
  });

  it('EC-47 rechaza una retirada con versión pero sin otorgamiento', () => {
    expectRejected({ consent_withdrawn_at: GIVEN_AT, consent_version: 'v1' });
  });

  it('acepta otorgado, y otorgado y retirado, con su versión', () => {
    insertCandidate({ consent_given_at: GIVEN_AT, consent_version: 'v1' });
    insertCandidate({
      email: 'otro@example.com',
      consent_given_at: GIVEN_AT,
      consent_version: 'v12',
      consent_withdrawn_at: '2026-09-23T09:00:00.000Z',
    });
    expect(countCandidates()).toBe(2);
  });
});

describe('dominio de columnas', () => {
  it.each<[string, Partial<CandidateRow>]>([
    ['nombre de 1 carácter', { full_name: 'A' }],
    ['nombre de 101 caracteres', { full_name: 'n'.repeat(101) }],
    ['teléfono de 5 caracteres', { phone: '12345' }],
    ['teléfono de 22 caracteres', { phone: '1'.repeat(22) }],
    ['resumen vacío', { summary: '' }],
    ['resumen de 2001 caracteres', { summary: 's'.repeat(2001) }],
    ['skills que no es JSON', { skills: 'sql, typescript' }],
    ['skills que es un objeto JSON', { skills: '{"sql":true}' }],
    ['skills que es una cadena JSON', { skills: '"sql"' }],
    [
      'skills con 21 elementos',
      { skills: JSON.stringify(Array.from({ length: 21 }, (_, i) => `s${i}`)) },
    ],
    ['created_at sin milisegundos', { created_at: '2026-09-21T08:00:00Z' }],
    ['created_at solo fecha', { created_at: '2026-09-21' }],
    [
      'consent_given_at con desplazamiento',
      { consent_given_at: '2026-09-22T09:00:00.000+02:00', consent_version: 'v1' },
    ],
    ['versión sin la v inicial', { consent_given_at: GIVEN_AT, consent_version: '1' }],
    ['versión "v" sin número', { consent_given_at: GIVEN_AT, consent_version: 'v' }],
    ['retention_ends_at con hora', { retention_ends_at: '2027-03-21T00:00:00.000Z' }],
    ['retention_ends_at con barras', { retention_ends_at: '21/03/2027' }],
  ])('la base rechaza %s', (_case, overrides) => {
    expectRejected(overrides);
  });
});

describe('INV-01 email único (DEC-08)', () => {
  it('rechaza dos INSERT con el mismo email con UNIQUE sobre candidates.email (errcode 2067)', () => {
    insertCandidate();
    let caught: unknown;
    try {
      insertCandidate({ full_name: 'Otra Persona' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      errcode: 2067,
      message: expect.stringContaining('UNIQUE constraint failed: candidates.email'),
    });
    expect(countCandidates()).toBe(1);
  });
});
