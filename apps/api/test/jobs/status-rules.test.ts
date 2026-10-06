import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job, JobStatus } from '../../src/modules/jobs/schemas.ts';
import {
  closeJob,
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
  publishJob,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Los casos hostiles de RF-03 (esquema antes que estado, fallo de SQLite, concurrencia entre borrar y
// publicar, intento de despublicar, repeticiones) van en TASK-06.
const NOW = '2026-10-06T08:00:00.000Z';
const ONE_HOUR_MS = 60 * 60 * 1000;

let app: FastifyInstance;
let clock: TestClock;

beforeEach(() => {
  clock = createTestClock(NOW);
  ({ app } = createTestApp({ now: clock.now }));
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

async function getJob(id: number): Promise<Job> {
  const response = await app.inject({ method: 'GET', url: `/api/jobs/${id}` });
  expect(response.statusCode).toBe(200);
  return response.json<Job>();
}

/** Publica un borrador completo en `NOW` y avanza el reloj una hora, para que `closedAt` difiera de `publishedAt`. */
async function publishedJob(body: Record<string, unknown> = {}): Promise<Job> {
  const job = await createPublishedJob(app, body);
  clock.advance(ONE_HOUR_MS);
  return job;
}

async function closedJob(): Promise<Job> {
  const published = await publishedJob();
  const closed = await closeJob(app, published.id);
  clock.advance(ONE_HOUR_MS);
  return closed;
}

function conflict(message: string) {
  return { error: { code: 'INVALID_TRANSITION', message } };
}

describe('PATCH /api/jobs/:id — estado de la oferta', () => {
  it('CA-10 PATCH válido a una cerrada → 409 y nada cambia', async () => {
    const closed = await closedJob();

    const response = await patchJob(closed.id, { title: 'Título nuevo inventado' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(conflict('Una oferta cerrada no se puede editar.'));
    expect(await getJob(closed.id)).toEqual(closed);
  });

  it.each([
    ['description', '   '],
    ['location', null],
    ['workMode', null],
  ])('CA-11/EC-17 vaciar %s de una publicada → 400 sin cambios', async (field, value) => {
    const published = await publishedJob();

    const response = await patchJob(published.id, { [field]: value });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field, message: 'Obligatorio en una oferta publicada.' }],
      },
    });
    expect(await getJob(published.id)).toEqual(published);
  });

  it('CA-11 vaciar un obligatorio y descuadrar la banda → un único 400 con los dos campos', async () => {
    const published = await publishedJob();

    const response = await patchJob(published.id, {
      location: null,
      salaryMin: 50000,
      salaryMax: 40000,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [
          { field: 'location', message: 'Obligatorio en una oferta publicada.' },
          { field: 'salaryMin', message: 'El salario mínimo no puede ser mayor que el máximo.' },
        ],
      },
    });
    expect(await getJob(published.id)).toEqual(published);
  });

  it('CA-12/EC-21/EC-44 PATCH tras cerrarla → 409 y nada cambia', async () => {
    const published = await publishedJob();
    const patched = await patchJob(published.id, { title: 'Título válido antes de cerrar' });
    expect(patched.statusCode).toBe(200);

    const closed = await closeJob(app, published.id);
    clock.advance(ONE_HOUR_MS);
    const response = await patchJob(published.id, { title: 'Título válido después de cerrar' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(conflict('Una oferta cerrada no se puede editar.'));
    expect(await getJob(published.id)).toEqual(closed);
    expect(closed.title).toBe('Título válido antes de cerrar');
  });

  it('EC-19 cambiar o vaciar la banda de una publicada → 200 sin tocar estado ni fechas', async () => {
    const published = await publishedJob({ salaryMin: 30000, salaryMax: 36000 });

    const changed = await patchJob(published.id, { salaryMin: 31000, salaryMax: 38000 });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toEqual({ ...published, salaryMin: 31000, salaryMax: 38000 });

    const emptied = await patchJob(published.id, { salaryMin: null, salaryMax: null });
    expect(emptied.statusCode).toBe(200);
    const expected: Job = { ...published, salaryMin: null, salaryMax: null };
    expect(emptied.json()).toEqual(expected);
    expect(emptied.json<Job>().status).toBe('published');
    expect(emptied.json<Job>().publishedAt).toBe(NOW);
    expect(await getJob(published.id)).toEqual(expected);
  });
});

describe('DELETE /api/jobs/:id — estado de la oferta', () => {
  it('CA-13 DELETE de una publicada y de una cerrada → 409', async () => {
    const published = await publishedJob({ title: 'Oferta publicada inventada' });
    const closed = await closedJob();

    const fromPublished = await deleteJob(published.id);
    expect(fromPublished.statusCode).toBe(409);
    expect(fromPublished.json()).toEqual(conflict('Una oferta publicada no se puede borrar.'));

    const fromClosed = await deleteJob(closed.id);
    expect(fromClosed.statusCode).toBe(409);
    expect(fromClosed.json()).toEqual(conflict('Una oferta cerrada no se puede borrar.'));

    expect(await getJob(published.id)).toEqual(published);
    expect(await getJob(closed.id)).toEqual(closed);
  });
});

type Action = 'publish' | 'close' | 'update' | 'remove';
type Outcome = 'apply' | 'noop' | string;

/** Tabla acción × estado de DD-02: `apply`, `noop` o el mensaje del 409. Escrita aparte de `rules.ts` a propósito. */
const TABLE: [Action, JobStatus, Outcome][] = [
  ['publish', 'draft', 'apply'],
  ['publish', 'published', 'noop'],
  ['publish', 'closed', 'Una oferta cerrada no se puede publicar.'],
  ['close', 'draft', 'Un borrador no se puede cerrar: publícalo primero.'],
  ['close', 'published', 'apply'],
  ['close', 'closed', 'noop'],
  ['update', 'draft', 'apply'],
  ['update', 'published', 'apply'],
  ['update', 'closed', 'Una oferta cerrada no se puede editar.'],
  ['remove', 'draft', 'apply'],
  ['remove', 'published', 'Una oferta publicada no se puede borrar.'],
  ['remove', 'closed', 'Una oferta cerrada no se puede borrar.'],
];

const UPDATED_TITLE = 'Título de la tabla DD-02';

async function jobInStatus(status: JobStatus): Promise<Job> {
  const draft = await createJob(app, {
    title: 'Oferta de la tabla inventada',
    description: 'Descripción inventada.',
    location: 'Sevilla',
    workMode: 'remota',
  });
  if (status === 'draft') return draft;
  const published = await publishJob(app, draft.id);
  clock.advance(ONE_HOUR_MS);
  if (status === 'published') return published;
  const closed = await closeJob(app, draft.id);
  clock.advance(ONE_HOUR_MS);
  return closed;
}

function runAction(action: Action, id: number) {
  switch (action) {
    case 'publish':
    case 'close':
      return app.inject({ method: 'POST', url: `/api/jobs/${id}/${action}` });
    case 'update':
      return patchJob(id, { title: UPDATED_TITLE });
    case 'remove':
      return deleteJob(id);
  }
}

const APPLIED: Record<Action, (before: Job) => Job | null> = {
  publish: (before) => ({
    ...before,
    status: 'published',
    publishedAt: new Date(clock.now()).toISOString(),
  }),
  close: (before) => ({
    ...before,
    status: 'closed',
    closedAt: new Date(clock.now()).toISOString(),
  }),
  update: (before) => ({ ...before, title: UPDATED_TITLE }),
  remove: () => null,
};

describe('DD-02 tabla de acciones × estados', () => {
  it.each(TABLE)('DD-02 %s sobre %s → %s', async (action, status, outcome) => {
    const before = await jobInStatus(status);

    const response = await runAction(action, before.id);

    if (outcome === 'apply') {
      const after = APPLIED[action](before);
      expect(response.statusCode).toBe(action === 'remove' ? 204 : 200);
      if (after) expect(response.json()).toEqual(after);
      const get = await app.inject({ method: 'GET', url: `/api/jobs/${before.id}` });
      expect(get.statusCode).toBe(after ? 200 : 404);
      if (after) expect(get.json()).toEqual(after);
    } else if (outcome === 'noop') {
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(before);
      expect(await getJob(before.id)).toEqual(before);
    } else {
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual(conflict(outcome));
      expect(await getJob(before.id)).toEqual(before);
    }
  });
});
