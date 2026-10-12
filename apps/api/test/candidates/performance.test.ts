import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { performance } from 'node:perf_hooks';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTransaction } from '../../src/db/transaction.ts';
import { createCandidatesRepository } from '../../src/modules/candidates/repository.ts';
import { csvBytes, importCsv } from '../helpers/csv.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. RNF-01 (lecturas) y RNF-02 (acciones) con 1 000 candidatos.
const NOW = '2026-10-06T22:30:00.000Z';
const CANDIDATES_IN_DB = 1000;
const REPETITIONS = 3;
const READ_BUDGET_MS = 200;
const WRITE_BUDGET_MS = 500;
const SKILLS = ['typescript', 'sql', 'react', 'python', 'java', 'figma'];

let app: FastifyInstance;
let lastId: number;
let database: DatabaseSync;

beforeEach(() => {
  const clock = createTestClock(NOW);
  const created = createTestApp({ now: clock.now });
  app = created.app;
  const { db } = created;
  database = db;
  const repository = createCandidatesRepository(db);
  withTransaction(db, () => {
    for (let n = 1; n <= CANDIDATES_IN_DB; n += 1) {
      const createdAt = new Date(Date.parse(NOW) - n * 60_000).toISOString();
      lastId = repository.insert(
        {
          fullName: `José Rendimiento ${n}`,
          email: `rendimiento${n}@example.com`,
          phone: null,
          summary: 'Resumen inventado para medir tiempos.',
          skills: [SKILLS[n % SKILLS.length]!],
        },
        createdAt,
        null,
      );
    }
  });
});

afterEach(async () => {
  await app.close();
});

/** Mide una petición; devuelve la respuesta y los milisegundos. */
async function timed(
  options: InjectOptions,
): Promise<{ response: LightMyRequestResponse; elapsedMs: number }> {
  const start = performance.now();
  const response = await app.inject(options);
  return { response, elapsedMs: performance.now() - start };
}

/** Calentamiento y varias repeticiones; devuelve el peor tiempo y comprueba el código de cada una. */
async function worstOf(options: InjectOptions, expectedStatus: number): Promise<number> {
  await app.inject(options);
  let worst = 0;
  for (let n = 0; n < REPETITIONS; n += 1) {
    const { response, elapsedMs } = await timed(options);
    expect(response.statusCode).toBe(expectedStatus);
    worst = Math.max(worst, elapsedMs);
  }
  return worst;
}

describe('rendimiento de la API de candidatos con 1 000 candidatos', () => {
  it('RNF-01 listado con q y skill, listado sin filtros y ficha < 200 ms', async () => {
    const filtered = await worstOf(
      { method: 'GET', url: '/api/candidates?q=JOSE&skill=SQL&page=1&pageSize=100' },
      200,
    );
    const unfiltered = await worstOf({ method: 'GET', url: '/api/candidates?pageSize=100' }, 200);
    const detail = await worstOf({ method: 'GET', url: `/api/candidates/${lastId}` }, 200);

    expect(filtered).toBeLessThan(READ_BUDGET_MS);
    expect(unfiltered).toBeLessThan(READ_BUDGET_MS);
    expect(detail).toBeLessThan(READ_BUDGET_MS);
  });

  it('RNF-02 alta, edición y cambios de consentimiento < 500 ms', async () => {
    const create = await timed({
      method: 'POST',
      url: '/api/candidates',
      payload: { fullName: 'Ana Medición', email: 'ana.medicion@example.com', consent: true },
    });
    const { id } = create.response.json<{ id: number }>();
    const patch = await timed({
      method: 'PATCH',
      url: `/api/candidates/${id}`,
      payload: { summary: 'Resumen inventado y editado.' },
    });
    const withdraw = await timed({
      method: 'POST',
      url: `/api/candidates/${id}/consent/withdrawal`,
    });
    const give = await timed({ method: 'POST', url: `/api/candidates/${id}/consent` });

    expect(create.response.statusCode).toBe(201);
    expect(patch.response.statusCode).toBe(200);
    expect(withdraw.response.statusCode).toBe(200);
    expect(give.response.statusCode).toBe(200);
    for (const { elapsedMs } of [create, patch, withdraw, give]) {
      expect(elapsedMs).toBeLessThan(WRITE_BUDGET_MS);
    }
  });

  it('RNF-01 importar 500 filas nuevas < 500 ms con 1 000 candidatos', async () => {
    const header = 'nombre,email,telefono';
    const fileOf = (prefix: string, count: number) =>
      csvBytes([
        header,
        ...Array.from({ length: count }, (_, i) => `Persona ${i},${prefix}${i}@example.com,`),
      ]);
    const warmUp = await importCsv(app, fileOf('calentamiento', 5));
    const start = performance.now();
    const response = await importCsv(app, fileOf('importado', 500));
    const elapsedMs = performance.now() - start;

    expect(warmUp.statusCode).toBe(200);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ dataRows: 500, created: 500 });
    expect(elapsedMs).toBeLessThan(WRITE_BUDGET_MS);
    const total = database.prepare('SELECT COUNT(*) AS total FROM candidates').get();
    expect(Number(total?.total)).toBe(CANDIDATES_IN_DB + 5 + 500);
  });
});
