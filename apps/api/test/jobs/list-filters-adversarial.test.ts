import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { loggerOptions } from '../../src/logger.ts';
import type { JobPage } from '../../src/modules/jobs/schemas.ts';
import { createJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. Los filtros y la paginación felices están en list-filters.test.ts.
const NOW = '2026-10-06T08:00:00.000Z';

const INVALID_FORMAT = 'Formato no válido.';
const STATUS_MESSAGE = 'Debe ser uno de estos valores: draft, published, closed.';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  const clock = createTestClock(NOW);
  ({ app, db } = createTestApp({ now: clock.now }));
});

afterEach(async () => {
  await app.close();
});

function validationError(field: string, message: string) {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Hay campos con errores.',
      details: [{ field, message }],
    },
  };
}

function list(query: string) {
  return app.inject({ method: 'GET', url: `/api/jobs${query}` });
}

async function listPage(query: string): Promise<JobPage> {
  const response = await list(query);
  expect(response.statusCode).toBe(200);
  return response.json<JobPage>();
}

const countJobs = (): number =>
  (db.prepare('SELECT COUNT(*) AS n FROM job_openings').get() as { n: number }).n;

describe('GET /api/jobs — parámetros inválidos', () => {
  it.each([
    ['page=0', 'page', INVALID_FORMAT],
    ['page=-1', 'page', INVALID_FORMAT],
    ['page=1.5', 'page', INVALID_FORMAT],
    ['pageSize=0', 'pageSize', INVALID_FORMAT],
    ['pageSize=abc', 'pageSize', INVALID_FORMAT],
    ['status=Published', 'status', STATUS_MESSAGE],
    ['status=draft&status=closed', 'status', 'Debe ser un texto.'],
    ['sort=title', 'querystring', 'Hay campos no permitidos.'],
  ])(
    'EC-32 parámetro inválido o desconocido (%s) → 400 con el parámetro',
    async (query, field, message) => {
      const response = await list(`?${query}`);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(validationError(field, message));
    },
  );

  it.each(['101', '0'])('CA-19 pageSize %s → 400 en pageSize', async (pageSize) => {
    const response = await list(`?pageSize=${pageSize}`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(validationError('pageSize', INVALID_FORMAT));
  });

  it('CA-21 status=archived → 400 en status', async () => {
    const response = await list('?status=archived');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(validationError('status', STATUS_MESSAGE));
  });
});

describe('GET /api/jobs — q', () => {
  it('CA-20 q de 101 → 400; de 100 → 200', async () => {
    const tooLong = await list(`?q=${encodeURIComponent('a'.repeat(101))}`);
    const limit = await list(`?q=${encodeURIComponent('a'.repeat(100))}`);

    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json()).toEqual(validationError('q', 'Debe tener como máximo 100 caracteres.'));
    expect(limit.statusCode).toBe(200);
  });

  it('CA-20 q cuenta puntos de código tras recortar (100 «ñ» más espacios → 200; 101 → 400)', async () => {
    const padded = (count: number) => encodeURIComponent(`  ${'ñ'.repeat(count)}  `);

    expect((await list(`?q=${padded(100)}`)).statusCode).toBe(200);
    expect((await list(`?q=${padded(101)}`)).statusCode).toBe(400);
  });

  it.each(['a%09b', 'a%0Ab', 'a%00'])(
    'CA-20/EC-33 q con carácter de control dentro (%s) → 400',
    async (q) => {
      const response = await list(`?q=${q}`);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(validationError('q', INVALID_FORMAT));
    },
  );

  it('DD-05 tabulador al borde de q se recorta', async () => {
    await createJob(app, { title: 'Técnico/a de ab inventado' });

    const response = await list('?q=%09ab%09');

    expect(response.statusCode).toBe(200);
    expect(response.json<JobPage>().total).toBe(1);
  });
});

describe('GET /api/jobs — q hostil (EC-39)', () => {
  it('EC-39 inyección, % y _ son literales', async () => {
    await createJob(app, { title: 'Analista de datos junior' });
    await createJob(app, { title: 'Operario/a de planta' });
    await createJob(app, { title: 'Descuento del 50% en formación' });
    await createJob(app, { title: 'Soporte_nivel_dos' });
    const before = countJobs();

    const injection = await listPage(`?q=${encodeURIComponent("' OR 1=1 --")}`);
    const semicolon = await listPage(`?q=${encodeURIComponent("'; DROP TABLE job_openings; --")}`);
    const percent = await listPage(`?q=${encodeURIComponent('%')}`);
    const underscore = await listPage(`?q=${encodeURIComponent('_')}`);

    expect(injection).toMatchObject({ items: [], total: 0 });
    expect(semicolon).toMatchObject({ items: [], total: 0 });
    expect(percent.items.map((item) => item.title)).toEqual(['Descuento del 50% en formación']);
    expect(underscore.items.map((item) => item.title)).toEqual(['Soporte_nivel_dos']);
    expect(countJobs()).toBe(before);
  });
});

describe('GET /api/jobs — logs (RNF-06)', () => {
  it('RNF-06/EC-39 el valor de q no aparece en los logs', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const secretDb = openDatabase(':memory:');
    migrate(secretDb);
    const logged = buildApp({ db: secretDb, logger: { ...loggerOptions, stream } });
    const value = "ana.inventada@example.com' OR 1=1 --";

    const ok = await logged.inject({
      method: 'GET',
      url: `/api/jobs?q=${encodeURIComponent(value)}`,
    });
    const bad = await logged.inject({ method: 'GET', url: '/api/jobs?q=ana.inventada&sort=title' });
    await logged.close();

    expect(ok.statusCode).toBe(200);
    expect(bad.statusCode).toBe(400);
    const logs = lines.join('');
    expect(logs).toContain('"path":"/api/jobs"');
    expect(logs).not.toContain('ana.inventada');
    expect(logs).not.toContain('example.com');
    expect(logs).not.toContain('OR 1=1');
    expect(logs).not.toContain('?q=');
  });
});
