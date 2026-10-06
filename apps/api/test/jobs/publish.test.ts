import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import {
  createJob,
  closeJob,
  createTestApp,
  createTestClock,
  failWrites,
  publishJob,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Camino feliz primero; los casos hostiles (adversarial, TASK-04) van al final.
const NOW = '2026-10-06T08:00:00.000Z';
const ONE_HOUR_MS = 60 * 60 * 1000;

let app: FastifyInstance;
let db: DatabaseSync;
let clock: TestClock;

beforeEach(() => {
  clock = createTestClock(NOW);
  ({ app, db } = createTestApp({ now: clock.now }));
});

afterEach(async () => {
  await app.close();
});

function postPublish(id: number) {
  return app.inject({ method: 'POST', url: `/api/jobs/${id}/publish` });
}

async function getJob(id: number): Promise<Job> {
  const response = await app.inject({ method: 'GET', url: `/api/jobs/${id}` });
  return response.json<Job>();
}

const COMPLETE = {
  title: 'Técnica/o de selección',
  description: 'Descripción inventada del puesto.',
  location: 'Valencia',
  workMode: 'híbrida',
  salaryMin: 32000,
  salaryMax: 40000,
};

describe('POST /api/jobs/:id/publish — publicar (camino feliz)', () => {
  it('CA-01 publica un borrador completo con publishedAt del reloj', async () => {
    const draft = await createJob(app, COMPLETE);

    const response = await postPublish(draft.id);

    expect(response.statusCode).toBe(200);
    expect(response.json<Job>()).toEqual({
      ...draft,
      status: 'published',
      publishedAt: '2026-10-06T08:00:00.000Z',
    });
    expect(await getJob(draft.id)).toEqual(response.json<Job>());
  });

  it('CA-02/EC-09 segunda publicación → 200 con la misma fecha', async () => {
    const draft = await createJob(app, COMPLETE);
    const first = (await postPublish(draft.id)).json<Job>();
    clock.advance(ONE_HOUR_MS);

    const second = await postPublish(draft.id);

    expect(second.statusCode).toBe(200);
    expect(second.json<Job>().publishedAt).toBe('2026-10-06T08:00:00.000Z');
    expect(second.json<Job>()).toEqual(first);
    expect(await getJob(draft.id)).toEqual(first);
  });

  it('EC-03 sin banda o en las fronteras de longitud → se publica', async () => {
    const noBand = await createJob(app, {
      title: 'Técnica/o de selección',
      description: 'Descripción inventada.',
      location: 'Valencia',
      workMode: 'remota',
    });
    const limits = await createJob(app, {
      ...COMPLETE,
      title: 'T'.repeat(120),
      description: 'd'.repeat(5000),
    });

    const first = await postPublish(noBand.id);
    const second = await postPublish(limits.id);

    expect(first.statusCode).toBe(200);
    expect(first.json<Job>()).toMatchObject({
      status: 'published',
      salaryMin: null,
      salaryMax: null,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json<Job>().title).toHaveLength(120);
    expect(second.json<Job>().description).toHaveLength(5000);
  });

  it('EC-04 publishedAt es el instante UTC del reloj', async () => {
    clock.set('2026-10-06T22:30:00Z');
    const draft = await createJob(app, COMPLETE);

    const response = await postPublish(draft.id);

    expect(response.json<Job>().publishedAt).toBe('2026-10-06T22:30:00.000Z');
  });

  it('EC-07 un borrador creado con POST se publica sin migrar nada', async () => {
    const draft = await createJob(app, COMPLETE);
    expect(draft).toMatchObject({ status: 'draft', publishedAt: null, closedAt: null });

    const published = await publishJob(app, draft.id);

    expect(published).toMatchObject({ id: draft.id, status: 'published', closedAt: null });
  });
});

const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'La oferta no existe.' } };

describe('POST /api/jobs/:id/publish — adversarial', () => {
  it('EC-01 ID no válido o con cuerpo → 400 sin cambios', async () => {
    const draft = await createJob(app, COMPLETE);

    const badId = await app.inject({ method: 'POST', url: '/api/jobs/abc/publish' });
    const withBody = await app.inject({
      method: 'POST',
      url: `/api/jobs/${draft.id}/publish`,
      payload: { status: 'closed' },
    });
    const badIdAndBody = await app.inject({
      method: 'POST',
      url: '/api/jobs/abc/publish',
      payload: { status: 'closed' },
    });

    expect(badId.statusCode).toBe(400);
    expect(badId.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field: 'id', message: 'Formato no válido.' }],
      },
    });
    const bodyError = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field: 'body', message: 'Esta acción no admite cuerpo.' }],
      },
    };
    expect(withBody.statusCode).toBe(400);
    expect(withBody.json()).toEqual(bodyError);
    expect(badIdAndBody.statusCode).toBe(400);
    expect(badIdAndBody.json()).toEqual(bodyError);
    expect(await getJob(draft.id)).toEqual(draft);
    expect(draft).toMatchObject({ status: 'draft', publishedAt: null });
  });

  it('CA-03/EC-02 campos pendientes → 400, uno por campo, y sigue en draft', async () => {
    const noDescriptionNorMode = await createJob(app, {
      title: 'Oferta a medias',
      location: 'Valencia',
    });
    const onlyTitle = await createJob(app, { title: 'Solo título', salaryMin: 20000 });

    const first = await postPublish(noDescriptionNorMode.id);
    const second = await postPublish(onlyTitle.id);

    const required = (field: string) => ({ field, message: 'Obligatorio para publicar.' });
    expect(first.statusCode).toBe(400);
    expect(first.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [required('description'), required('workMode')],
      },
    });
    expect(second.statusCode).toBe(400);
    expect(second.json<{ error: { details: unknown[] } }>().error.details).toEqual([
      required('description'),
      required('location'),
      required('workMode'),
    ]);
    for (const original of [noDescriptionNorMode, onlyTitle]) {
      const after = await getJob(original.id);
      expect(after).toEqual(original);
      expect(after).toMatchObject({ status: 'draft', publishedAt: null });
    }
  });

  it('CA-04 publicar una cerrada → 409 y nada cambia', async () => {
    const published = await createJob(app, COMPLETE);
    await publishJob(app, published.id);
    clock.advance(ONE_HOUR_MS);
    const closed = await closeJob(app, published.id);
    clock.advance(ONE_HOUR_MS);

    const response = await postPublish(closed.id);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: { code: 'INVALID_TRANSITION', message: 'Una oferta cerrada no se puede publicar.' },
    });
    const after = await getJob(closed.id);
    expect(after).toEqual(closed);
    expect(after).toMatchObject({ status: 'closed', publishedAt: NOW });
  });

  it('EC-05 fallo de SQLite al publicar → 500 y sigue en draft', async () => {
    const draft = await createJob(app, COMPLETE);
    failWrites(db, 'UPDATE');

    const response = await postPublish(draft.id);

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
    });
    expect(response.body).not.toContain('fallo simulado');
    expect(response.body).not.toContain('stack');
    const after = await getJob(draft.id);
    expect(after).toEqual(draft);
    expect(after).toMatchObject({ status: 'draft', publishedAt: null });
  });

  it('EC-06 publicar una oferta borrada → 404', async () => {
    const draft = await createJob(app, COMPLETE);
    const deleted = await app.inject({ method: 'DELETE', url: `/api/jobs/${draft.id}` });
    expect(deleted.statusCode).toBe(204);

    const response = await postPublish(draft.id);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
  });

  it('EC-08 IDs inexistentes → 404 sin ID ni datos', async () => {
    for (const id of [999999, 1234567890123]) {
      const response = await postPublish(id);

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(NOT_FOUND);
      expect(response.body).not.toContain(String(id));
    }
  });
});
