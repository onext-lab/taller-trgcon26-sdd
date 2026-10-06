import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { failWrites } from '../helpers/test-app.ts';

// Datos inventados. INSERT directos con sentencias preparadas: la base se defiende aunque se salte la API.
interface JobRow {
  title: SQLInputValue;
  description: SQLInputValue;
  location: SQLInputValue;
  work_mode: SQLInputValue;
  salary_min: SQLInputValue;
  salary_max: SQLInputValue;
  status: SQLInputValue;
  created_at: SQLInputValue;
  published_at: SQLInputValue;
  closed_at: SQLInputValue;
}

const VALID_DRAFT: JobRow = {
  title: 'Analista de datos junior',
  description: 'Apoyo al equipo de datos con informes y limpieza de datos.',
  location: 'Sevilla',
  work_mode: 'híbrida',
  salary_min: 26000,
  salary_max: 31000,
  status: 'draft',
  created_at: '2026-09-21T08:00:00.000Z',
  published_at: null,
  closed_at: null,
};

const PUBLISHED_AT = '2026-09-22T09:00:00.000Z';
const CHECK_FAILED = /CHECK constraint failed/;

let db: DatabaseSync;

function insertJob(overrides: Partial<JobRow> = {}): void {
  const row = { ...VALID_DRAFT, ...overrides };
  db.prepare(
    `INSERT INTO job_openings
       (title, description, location, work_mode, salary_min, salary_max, status, created_at, published_at, closed_at)
     VALUES
       (:title, :description, :location, :work_mode, :salary_min, :salary_max, :status, :created_at, :published_at, :closed_at)`,
  ).run({ ...row });
}

function countJobs(): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM job_openings').get();
  return Number(row?.total);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
});

afterEach(() => {
  db.close();
});

describe('migración 001-create-job-openings', () => {
  it('RF-07 migrate la aplica sobre :memory: y la registra en schema_migrations', () => {
    const fresh = openDatabase(':memory:');
    try {
      expect(migrate(fresh)).toContain('001-create-job-openings.sql');
      const names = fresh
        .prepare('SELECT name FROM schema_migrations')
        .all()
        .map((row) => row.name);
      expect(names).toContain('001-create-job-openings.sql');
      const index = fresh
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
        .get('job_openings_reference_date_idx');
      expect(index).toBeDefined();
      expect(migrate(fresh)).toEqual([]);
    } finally {
      fresh.close();
    }
  });

  it('EC-16 la base rechaza mínimo > máximo', () => {
    expect(() => insertJob({ salary_min: 31001, salary_max: 31000 })).toThrow(CHECK_FAILED);
    expect(countJobs()).toBe(0);
  });

  it.each<[string, Partial<JobRow>]>([
    ['estado desconocido', { status: 'archived' }],
    ['modalidad sin tilde', { work_mode: 'hibrida' }],
    ['modalidad en mayúsculas', { work_mode: 'Remota' }],
    ['modalidad con í descompuesta (NFD)', { work_mode: 'híbrida' }],
    ['salario mínimo 0', { salary_min: 0 }],
    ['salario mínimo negativo', { salary_min: -1 }],
    ['salario máximo 0', { salary_max: 0 }],
    ['salario mínimo real 40000.5', { salary_min: 40000.5, salary_max: null }],
    ['salario máximo real 40000.5', { salary_max: 40000.5, salary_min: null }],
    ['título de 2 caracteres', { title: 'ab' }],
    ['título de 121 caracteres', { title: 'a'.repeat(121) }],
    ['descripción vacía', { description: '' }],
    ['ubicación de 1 carácter', { location: 'S' }],
    ['created_at sin milisegundos', { created_at: '2026-09-21T08:00:00Z' }],
    ['created_at con espacio', { created_at: '2026-09-21 08:00:00.000Z' }],
    ['created_at con desplazamiento', { created_at: '2026-09-21T08:00:00.000+02:00' }],
    ['created_at solo fecha', { created_at: '2026-09-21' }],
  ])(
    'la base rechaza estado, modalidad, salario, título y fecha fuera de dominio: %s',
    (_case, overrides) => {
      expect(() => insertJob(overrides)).toThrow(CHECK_FAILED);
      expect(countJobs()).toBe(0);
    },
  );

  it('acepta un borrador válido, completo o solo con título, en las fronteras de longitud', () => {
    insertJob();
    insertJob({
      title: 'abc',
      description: null,
      location: null,
      work_mode: null,
      salary_min: null,
      salary_max: null,
    });
    insertJob({
      title: 'a'.repeat(120),
      work_mode: 'presencial',
      salary_min: 30000,
      salary_max: 30000,
    });
    insertJob({ title: '🎨'.repeat(120), location: 'Bi', work_mode: 'remota' });
    expect(countJobs()).toBe(4);
    const first = db.prepare('SELECT * FROM job_openings ORDER BY id LIMIT 1').get();
    expect(first).toMatchObject({
      id: 1,
      status: 'draft',
      work_mode: 'híbrida',
      salary_min: 26000,
    });
  });
});

describe('DD-08 coherencia estado-fechas e INV-04', () => {
  it.each<[string, Partial<JobRow>]>([
    ['published sin published_at', { status: 'published' }],
    [
      'published sin descripción',
      { status: 'published', published_at: PUBLISHED_AT, description: null },
    ],
    [
      'published sin ubicación',
      { status: 'published', published_at: PUBLISHED_AT, location: null },
    ],
    [
      'published sin modalidad',
      { status: 'published', published_at: PUBLISHED_AT, work_mode: null },
    ],
    [
      'published con closed_at',
      { status: 'published', published_at: PUBLISHED_AT, closed_at: PUBLISHED_AT },
    ],
    ['draft con published_at', { published_at: PUBLISHED_AT }],
    ['closed sin closed_at', { status: 'closed', published_at: PUBLISHED_AT }],
  ])(
    'DD-08 la base rechaza published sin published_at o sin campos obligatorios: %s',
    (_case, overrides) => {
      expect(() => insertJob(overrides)).toThrow(CHECK_FAILED);
      expect(countJobs()).toBe(0);
    },
  );

  it('DD-08 acepta published completo con published_at', () => {
    insertJob({ status: 'published', published_at: PUBLISHED_AT });
    expect(countJobs()).toBe(1);
  });
});

describe('failWrites', () => {
  it("failWrites(db, 'INSERT') hace fallar el siguiente INSERT con un error de SQLite", () => {
    failWrites(db, 'INSERT');
    expect(() => insertJob()).toThrow(/fallo simulado/);
    expect(countJobs()).toBe(0);
  });

  it("failWrites(db, 'UPDATE') y 'DELETE' hacen fallar esas escrituras y dejan la fila intacta", () => {
    insertJob();
    failWrites(db, 'UPDATE');
    failWrites(db, 'DELETE');
    expect(() =>
      db.prepare('UPDATE job_openings SET title = ? WHERE id = 1').run('Otro título'),
    ).toThrow(/fallo simulado/);
    expect(() => db.prepare('DELETE FROM job_openings WHERE id = 1').run()).toThrow(
      /fallo simulado/,
    );
    const row = db.prepare('SELECT title FROM job_openings WHERE id = 1').get();
    expect(row?.title).toBe('Analista de datos junior');
  });
});
