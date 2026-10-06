import type { FastifyInstance } from 'fastify';
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. TASK-05 añadirá RNF-02 (escrituras) en este mismo fichero.
const NOW = '2026-10-06T22:30:00.000Z';
const JOBS_IN_DB = 100;
const READ_BUDGET_MS = 200;

let app: FastifyInstance;
let lastId: number;

beforeEach(async () => {
  const clock = createTestClock(NOW);
  ({ app } = createTestApp({ now: clock.now }));
  for (let n = 1; n <= JOBS_IN_DB; n += 1) {
    const job = await createJob(app, {
      title: `Oferta de rendimiento ${n}`,
      description: 'Descripción inventada para medir tiempos de lectura.',
      location: 'Valladolid',
      workMode: 'presencial',
    });
    lastId = job.id;
    clock.advance(1000);
  }
});

afterEach(async () => {
  await app.close();
});

/** Mide una petición GET tras otra de calentamiento; devuelve el código y los milisegundos. */
async function timedGet(url: string): Promise<{ statusCode: number; elapsedMs: number }> {
  await app.inject({ method: 'GET', url });
  const start = performance.now();
  const response = await app.inject({ method: 'GET', url });
  return { statusCode: response.statusCode, elapsedMs: performance.now() - start };
}

describe('rendimiento de la API de ofertas', () => {
  it('RNF-01 GET /api/jobs y /api/jobs/:id < 200 ms con 100 ofertas', async () => {
    const list = await timedGet('/api/jobs');
    expect(list.statusCode).toBe(200);
    expect(list.elapsedMs).toBeLessThan(READ_BUDGET_MS);

    const detail = await timedGet(`/api/jobs/${lastId}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.elapsedMs).toBeLessThan(READ_BUDGET_MS);
  });
});
