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

/** Alta, publicar, cerrar, duplicar, PATCH y DELETE de una oferta nueva; devuelve cada tiempo con su respuesta. */
async function lifecycleCycle(n: number) {
  const create = await timed({
    method: 'POST',
    url: '/api/jobs',
    payload: {
      title: `Oferta de ciclo ${n}`,
      description: 'Descripción inventada.',
      location: 'Burgos',
      workMode: 'remota',
    },
  });
  const { id } = create.response.json<{ id: number }>();
  const publish = await timed({ method: 'POST', url: `/api/jobs/${id}/publish` });
  const close = await timed({ method: 'POST', url: `/api/jobs/${id}/close` });
  const duplicate = await timed({ method: 'POST', url: `/api/jobs/${id}/duplicate` });
  const copyId = duplicate.response.json<{ id: number }>().id;
  const patch = await timed({
    method: 'PATCH',
    url: `/api/jobs/${copyId}`,
    payload: { description: 'Descripción inventada editada.' },
  });
  const del = await timed({ method: 'DELETE', url: `/api/jobs/${copyId}` });
  return { create, publish, close, duplicate, patch, del };
}

describe('rendimiento de la API de ofertas', () => {
  it('RNF-01 listado con filtros y pageSize=100, ficha y close-preview < 200 ms con 100 ofertas', async () => {
    const list = await timedGet('/api/jobs');
    expect(list.statusCode).toBe(200);
    expect(list.elapsedMs).toBeLessThan(READ_BUDGET_MS);

    const filtered = await timedGet('/api/jobs?status=draft&q=RENDIMIENTO&page=1&pageSize=100');
    expect(filtered.statusCode).toBe(200);
    expect(filtered.elapsedMs).toBeLessThan(READ_BUDGET_MS);

    const detail = await timedGet(`/api/jobs/${lastId}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.elapsedMs).toBeLessThan(READ_BUDGET_MS);

    const preview = await timedGet(`/api/jobs/${lastId}/close-preview`);
    expect(preview.statusCode).toBe(200);
    expect(preview.elapsedMs).toBeLessThan(READ_BUDGET_MS);
  });

  it('RNF-02 publicar, cerrar, duplicar, PATCH y DELETE < 500 ms con 100 ofertas', async () => {
    await lifecycleCycle(0); // calentamiento
    const { create, publish, close, duplicate, patch, del } = await lifecycleCycle(1);

    expect(create.response.statusCode).toBe(201);
    expect(publish.response.statusCode).toBe(200);
    expect(close.response.statusCode).toBe(200);
    expect(duplicate.response.statusCode).toBe(201);
    expect(patch.response.statusCode).toBe(200);
    expect(del.response.statusCode).toBe(204);
    for (const { elapsedMs } of [create, publish, close, duplicate, patch, del]) {
      expect(elapsedMs).toBeLessThan(WRITE_BUDGET_MS);
    }
  });
});
