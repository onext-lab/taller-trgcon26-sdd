import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import {
  closeJob,
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
  failWrites,
  publishJob,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Casos hostiles de RF-03 (TASK-06); los felices y la tabla DD-02 están en status-rules.test.ts, que
// pasaría de 300 líneas con estos, por eso van en este hermano.
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

function patchJob(id: number, payload: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: `/api/jobs/${id}`, payload });
}

function deleteJob(id: number) {
  return app.inject({ method: 'DELETE', url: `/api/jobs/${id}` });
}

function publishRequest(id: number) {
  return app.inject({ method: 'POST', url: `/api/jobs/${id}/publish` });
}

async function getJob(id: number): Promise<Job> {
  const response = await app.inject({ method: 'GET', url: `/api/jobs/${id}` });
  expect(response.statusCode).toBe(200);
  return response.json<Job>();
}

/** Publica un borrador completo en `NOW` y avanza el reloj una hora, para que `closedAt` difiera de `publishedAt`. */
async function publishedJob(): Promise<Job> {
  const job = await createPublishedJob(app);
  clock.advance(ONE_HOUR_MS);
  return job;
}

const COMPLETE_DRAFT = {
  title: 'Oferta completa inventada',
  description: 'Descripción inventada del puesto.',
  location: 'Sevilla',
  workMode: 'remota',
};

function conflict(message: string) {
  return { error: { code: 'INVALID_TRANSITION', message } };
}

describe('PATCH /api/jobs/:id — hostil (EC-18, EC-20, EC-23)', () => {
  it('EC-18 PATCH inválido a una cerrada → 400 (esquema antes que estado)', async () => {
    const published = await publishedJob();
    const closed = await closeJob(app, published.id);
    clock.advance(ONE_HOUR_MS);

    const response = await patchJob(closed.id, { title: 'ab' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field: 'title', message: 'Debe tener al menos 3 caracteres.' }],
      },
    });
    expect(await getJob(closed.id)).toEqual(closed);
  });

  it('EC-20 fallo de SQLite al editar una publicada → 500 sin cambios', async () => {
    const published = await publishedJob();
    failWrites(db, 'UPDATE');

    const response = await patchJob(published.id, { title: 'Título que no llegará a guardarse' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
    });
    expect(response.body).not.toContain('fallo simulado');
    expect(response.body).not.toContain('SQLITE');
    expect(response.body).not.toContain('stack');
    expect(await getJob(published.id)).toEqual(published);
  });

  it.each([{ status: 'draft' }, { publishedAt: '2026-01-01T00:00:00.000Z' }])(
    'EC-23 PATCH con status o publishedAt sobre una publicada → 400 sin cambios (%o)',
    async (payload) => {
      const published = await publishedJob();
      const [field] = Object.keys(payload);

      const response = await patchJob(published.id, payload);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Hay campos con errores.',
          details: [{ field, message: 'Campo no permitido.' }],
        },
      });
      expect(await getJob(published.id)).toEqual(published);
    },
  );
});

describe('DELETE y publicación — concurrencia y repeticiones (EC-21, CA-13, EC-24)', () => {
  it('EC-21 DELETE tras publicarla → 409; publicar tras borrarla → 404', async () => {
    const toPublish = await createJob(app, COMPLETE_DRAFT);
    const toDelete = await createJob(app, { ...COMPLETE_DRAFT, title: 'Otra oferta inventada' });

    // Otra pestaña publica el borrador antes de que llegue el borrado.
    const published = await publishJob(app, toPublish.id);
    const deleted = await deleteJob(toPublish.id);
    expect(deleted.statusCode).toBe(409);
    expect(deleted.json()).toEqual(conflict('Una oferta publicada no se puede borrar.'));
    expect(await getJob(toPublish.id)).toEqual(published);

    // Otra pestaña borra el borrador antes de que llegue la publicación.
    expect((await deleteJob(toDelete.id)).statusCode).toBe(204);
    const late = await publishRequest(toDelete.id);
    expect(late.statusCode).toBe(404);
    expect(late.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'La oferta no existe.' } });
  });

  it('CA-13/EC-24 dos DELETE de una publicada → 409; el mismo PATCH dos veces → 200 igual', async () => {
    const published = await publishedJob();
    const expected = conflict('Una oferta publicada no se puede borrar.');

    const first = await deleteJob(published.id);
    const second = await deleteJob(published.id);

    expect(first.statusCode).toBe(409);
    expect(first.json()).toEqual(expected);
    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual(expected);
    expect(await getJob(published.id)).toEqual(published);

    const patch = { title: 'Título repetido inventado', salaryMin: 33000 };
    const patchedOnce = await patchJob(published.id, patch);
    const patchedTwice = await patchJob(published.id, patch);

    expect(patchedOnce.statusCode).toBe(200);
    expect(patchedTwice.statusCode).toBe(200);
    expect(patchedTwice.json()).toEqual(patchedOnce.json());
    expect(patchedOnce.json()).toEqual({ ...published, ...patch });
  });
});
