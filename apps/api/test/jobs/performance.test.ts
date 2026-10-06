import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. RNF-01 (lecturas) y RNF-02 (escrituras).
const NOW = '2026-10-06T22:30:00.000Z';
const JOBS_IN_DB = 100;
const READ_BUDGET_MS = 200;
const WRITE_BUDGET_MS = 500;

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

/** Mide una petición; devuelve la respuesta y los milisegundos. */
async function timed(
  options: InjectOptions,
): Promise<{ response: LightMyRequestResponse; elapsedMs: number }> {
  const start = performance.now();
  const response = await app.inject(options);
  return { response, elapsedMs: performance.now() - start };
}

/** POST, PATCH y DELETE de una oferta nueva; devuelve los tres tiempos con sus códigos. */
async function writeCycle(n: number) {
  const post = await timed({
    method: 'POST',
    url: '/api/jobs',
    payload: { title: `Oferta de escritura ${n}`, location: 'Toledo' },
  });
  const { id } = post.response.json<{ id: number }>();
  const patch = await timed({
    method: 'PATCH',
    url: `/api/jobs/${id}`,
    payload: { description: 'Descripción inventada editada.', salaryMin: 25000 },
  });
  const del = await timed({ method: 'DELETE', url: `/api/jobs/${id}` });
  return { post, patch, del };
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

  it('RNF-02 POST, PATCH y DELETE < 500 ms con 100 ofertas', async () => {
    await writeCycle(0); // calentamiento
    const { post, patch, del } = await writeCycle(1);

    expect(post.response.statusCode).toBe(201);
    expect(post.elapsedMs).toBeLessThan(WRITE_BUDGET_MS);
    expect(patch.response.statusCode).toBe(200);
    expect(patch.elapsedMs).toBeLessThan(WRITE_BUDGET_MS);
    expect(del.response.statusCode).toBe(204);
    expect(del.elapsedMs).toBeLessThan(WRITE_BUDGET_MS);
  });
});
