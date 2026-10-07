import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import {
  closeJob,
  createApplicationsSpy,
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
  failWrites,
  type ApplicationsSpy,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Camino feliz primero; los casos hostiles (adversarial, TASK-04) van al final.
const PUBLISH_AT = '2026-10-05T08:00:00.000Z';
const CLOSE_AT = '2026-10-06T22:30:00.000Z';
const ONE_HOUR_MS = 60 * 60 * 1000;

let app: FastifyInstance;
let db: DatabaseSync;
let clock: TestClock;
let spy: ApplicationsSpy;

beforeEach(() => {
  clock = createTestClock(PUBLISH_AT);
  spy = createApplicationsSpy();
  ({ app, db } = createTestApp({ now: clock.now, jobApplications: spy.port }));
});

afterEach(async () => {
  await app.close();
});

function closePreview(id: number) {
  return app.inject({ method: 'GET', url: `/api/jobs/${id}/close-preview` });
}

function postClose(id: number) {
  return app.inject({ method: 'POST', url: `/api/jobs/${id}/close` });
}

async function getJob(id: number): Promise<Job> {
  const response = await app.inject({ method: 'GET', url: `/api/jobs/${id}` });
  return response.json<Job>();
}

describe('cierre de ofertas (camino feliz)', () => {
  it('CA-05/EC-11/EC-42 previa con 0, cierre con closedAt del reloj y puerto invocado una vez', async () => {
    const published = await createPublishedJob(app);

    const preview = await closePreview(published.id);
    clock.set(CLOSE_AT);
    const response = await postClose(published.id);

    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toEqual({ activeApplications: 0 });
    expect(response.statusCode).toBe(200);
    expect(response.json<Job>()).toEqual({ ...published, status: 'closed', closedAt: CLOSE_AT });
    expect(response.json<Job>().createdAt).toBe(PUBLISH_AT);
    expect(response.json<Job>().publishedAt).toBe(PUBLISH_AT);
    expect(spy.rejectCalls).toEqual([{ jobId: published.id, closedAt: CLOSE_AT }]);
    expect(await getJob(published.id)).toEqual(response.json<Job>());
  });

  it('CA-06 la previa no cambia la oferta', async () => {
    const published = await createPublishedJob(app);

    const preview = await closePreview(published.id);

    expect(preview.statusCode).toBe(200);
    const after = await getJob(published.id);
    expect(after).toEqual(published);
    expect(after).toMatchObject({ status: 'published', closedAt: null });
    expect(spy.rejectCalls).toHaveLength(0);
  });

  it('CA-07/EC-13/EC-16 segundo cierre → 200 sin cambios ni nueva invocación', async () => {
    const published = await createPublishedJob(app);
    clock.set(CLOSE_AT);
    const first = await closeJob(app, published.id);
    clock.advance(ONE_HOUR_MS);

    const second = await postClose(published.id);

    expect(second.statusCode).toBe(200);
    expect(second.json<Job>()).toEqual(first);
    expect(second.json<Job>().closedAt).toBe(CLOSE_AT);
    expect(spy.rejectCalls).toHaveLength(1);
    expect(await getJob(published.id)).toEqual(first);
  });
});

const INTERNAL_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};

const INVALID_ID = {
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Hay campos con errores.',
    details: [{ field: 'id', message: 'Formato no válido.' }],
  },
};

function expectRolledBack(response: { statusCode: number; body: string }, before: Job, after: Job) {
  expect(response.statusCode).toBe(500);
  expect(response.body).not.toContain('fallo simulado');
  expect(response.body).not.toContain('stack');
  expect(after).toEqual(before);
  expect(after).toMatchObject({ status: 'published', closedAt: null });
}

describe('POST /api/jobs/:id/close — adversarial', () => {
  it('EC-10 ID no válido (1.5) o con cuerpo → 400 sin cambios', async () => {
    const published = await createPublishedJob(app);

    const badId = await app.inject({ method: 'POST', url: '/api/jobs/1.5/close' });
    const withBody = await app.inject({
      method: 'POST',
      url: `/api/jobs/${published.id}/close`,
      payload: { status: 'draft' },
    });

    expect(badId.statusCode).toBe(400);
    expect(badId.json()).toEqual(INVALID_ID);
    expect(withBody.statusCode).toBe(400);
    expect(withBody.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field: 'body', message: 'Esta acción no admite cuerpo.' }],
      },
    });
    const after = await getJob(published.id);
    expect(after).toEqual(published);
    expect(after.status).toBe('published');
    expect(spy.rejectCalls).toHaveLength(0);
  });

  it('CA-08 cerrar un borrador → 409 y sigue en draft', async () => {
    const draft = await createJob(app, { title: 'Borrador sin publicar' });

    const response = await postClose(draft.id);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_TRANSITION',
        message: 'Un borrador no se puede cerrar: publícalo primero.',
      },
    });
    const after = await getJob(draft.id);
    expect(after).toEqual(draft);
    expect(after).toMatchObject({ status: 'draft', closedAt: null });
    expect(spy.rejectCalls).toHaveLength(0);
  });

  it('CA-09/EC-12 el punto de rechazo falla → 500 y sigue publicada', async () => {
    const failing = createApplicationsSpy({ failOnReject: true });
    await app.close();
    ({ app, db } = createTestApp({ now: clock.now, jobApplications: failing.port }));
    const published = await createPublishedJob(app);
    clock.set(CLOSE_AT);

    const response = await postClose(published.id);

    expect(failing.rejectCalls).toEqual([{ jobId: published.id, closedAt: CLOSE_AT }]);
    expect(response.json()).toEqual(INTERNAL_ERROR);
    expectRolledBack(response, published, await getJob(published.id));
  });

  it('EC-12 fallo de SQLite al cerrar → 500 y sigue publicada', async () => {
    const published = await createPublishedJob(app);
    failWrites(db, 'UPDATE');

    const response = await postClose(published.id);

    expect(response.json()).toEqual(INTERNAL_ERROR);
    expectRolledBack(response, published, await getJob(published.id));
    expect(spy.rejectCalls).toHaveLength(0);
  });

  it('DT-01 close-preview de una oferta inexistente → 404; ID inválido → 400', async () => {
    const missing = await closePreview(999999);
    const invalid = await app.inject({ method: 'GET', url: '/api/jobs/abc/close-preview' });

    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'La oferta no existe.' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual(INVALID_ID);
  });
});

describe('POST /api/jobs/:id/close — puerto por defecto (INV-05)', () => {
  // EC-14: ventana de INV-05 mientras no existe `applications`. HU-06 sustituirá este test al conectar UC-19
  // (cierre que rechaza las inscripciones activas) con el puerto real.
  it('EC-14 sin puerto de inscripciones: previa con 0 y cierre 200 sin nada que rechazar', async () => {
    await app.close();
    ({ app, db } = createTestApp({ now: clock.now }));
    const published = await createPublishedJob(app);

    const preview = await closePreview(published.id);
    clock.set(CLOSE_AT);
    const response = await postClose(published.id);

    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toEqual({ activeApplications: 0 });
    expect(response.statusCode).toBe(200);
    expect(response.json<Job>()).toEqual({ ...published, status: 'closed', closedAt: CLOSE_AT });
    expect(await getJob(published.id)).toEqual(response.json<Job>());
  });
});
