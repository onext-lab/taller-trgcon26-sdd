import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { createJob, createTestApp } from '../helpers/test-app.ts';

let app: FastifyInstance;
let db: DatabaseSync;
let job: Job;

beforeEach(async () => {
  ({ app, db } = createTestApp());
  job = await createJob(app, { title: 'Analista de datos junior' });
});

afterEach(async () => {
  await app.close();
});

const FORBIDDEN = {
  error: { code: 'CROSS_SITE_REQUEST', message: 'Petición no permitida desde otro sitio.' },
};

function countJobs(): number {
  return Number(db.prepare('SELECT COUNT(*) AS total FROM job_openings').get()?.total);
}

function readJob(): unknown {
  return db.prepare('SELECT * FROM job_openings WHERE id = ?').get(job.id);
}

interface WriteCase {
  name: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  url: () => string;
  payload?: Record<string, unknown>;
  ok: 201 | 200 | 204;
}

// Las escrituras de HU-01; TASK-04 añade publicar, cerrar y duplicar.
const WRITES: WriteCase[] = [
  {
    name: 'POST /api/jobs',
    method: 'POST',
    url: () => '/api/jobs',
    payload: { title: 'Oferta nueva' },
    ok: 201,
  },
  {
    name: 'PATCH /api/jobs/:id',
    method: 'PATCH',
    url: () => `/api/jobs/${job.id}`,
    payload: { title: 'Título cambiado' },
    ok: 200,
  },
  { name: 'DELETE /api/jobs/:id', method: 'DELETE', url: () => `/api/jobs/${job.id}`, ok: 204 },
];

describe('DEC-12 — escrituras entre sitios', () => {
  it.each(WRITES)('EC-49 $name con cross-site → 403 y nada cambia', async (write) => {
    const rowsBefore = countJobs();
    const jobBefore = readJob();

    const response = await app.inject({
      method: write.method,
      url: write.url(),
      payload: write.payload,
      headers: { 'sec-fetch-site': 'cross-site' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(FORBIDDEN);
    expect(countJobs()).toBe(rowsBefore);
    expect(readJob()).toEqual(jobBefore);
  });

  const SAFE_VALUES: (string | undefined)[] = ['same-origin', 'same-site', 'none', undefined];

  for (const write of WRITES) {
    it.each(SAFE_VALUES)(`EC-49 ${write.name} con sec-fetch-site=%s → 2xx`, async (value) => {
      const response = await app.inject({
        method: write.method,
        url: write.url(),
        payload: write.payload,
        headers: value === undefined ? {} : { 'sec-fetch-site': value },
      });

      expect(response.statusCode).toBe(write.ok);
    });
  }

  it('EC-49 GET cross-site → 200 (solo se protegen las escrituras)', async () => {
    const headers = { 'sec-fetch-site': 'cross-site' };

    const list = await app.inject({ method: 'GET', url: '/api/jobs', headers });
    const detail = await app.inject({ method: 'GET', url: `/api/jobs/${job.id}`, headers });

    expect(list.statusCode).toBe(200);
    expect(detail.statusCode).toBe(200);
  });

  it('EC-49 el 403 llega antes que la validación del cuerpo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: { title: 'x', campoAjeno: 1 },
      headers: { 'sec-fetch-site': 'cross-site' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(FORBIDDEN);
  });
});
