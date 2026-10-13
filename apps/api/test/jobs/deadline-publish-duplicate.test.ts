import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorDetail } from '../../src/errors.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import {
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Reloj en 2026-10-13 (Madrid); CA-07 (publicar con el plazo vencido) y S-01 (idempotencia).
const COMPLETE = {
  title: 'Técnica/o de selección',
  description: 'Descripción inventada del puesto.',
  location: 'Valencia',
  workMode: 'híbrida',
};
const EXPIRED = {
  field: 'enrollmentDeadline',
  message: 'La fecha límite de inscripción ya ha pasado.',
};

let app: FastifyInstance;
let clock: TestClock;

beforeEach(() => {
  clock = createTestClock('2026-10-13T10:00:00Z');
  ({ app } = createTestApp({ now: clock.now }));
});

afterEach(async () => {
  await app.close();
});

function publish(id: number) {
  return app.inject({ method: 'POST', url: `/api/jobs/${id}/publish` });
}

async function getJob(id: number): Promise<Job> {
  return (await app.inject({ method: 'GET', url: `/api/jobs/${id}` })).json<Job>();
}

/** Borrador creado el 1 de octubre con el plazo dado; el reloj vuelve a «hoy» (DD-12). */
async function draftWithDeadline(
  deadline: string,
  extra: Record<string, unknown> = {},
): Promise<Job> {
  clock.set('2026-10-01T10:00:00Z');
  const draft = await createJob(app, { ...COMPLETE, enrollmentDeadline: deadline, ...extra });
  clock.set('2026-10-13T10:00:00Z');
  return draft;
}

describe('fecha límite — publicar', () => {
  it('CA-07 publicar con 2026-10-10 → 400 con enrollmentDeadline y sigue draft; con hoy → 200', async () => {
    const expired = await draftWithDeadline('2026-10-10');
    const today = await draftWithDeadline('2026-10-13');

    const rejected = await publish(expired.id);
    const accepted = await publish(today.id);

    expect(rejected.statusCode).toBe(400);
    expect(
      rejected.json<{ error: { code: string; details: ErrorDetail[] } }>().error,
    ).toMatchObject({ code: 'VALIDATION_ERROR', details: [EXPIRED] });
    expect(rejected.body).not.toContain('2026-10-10');
    expect(await getJob(expired.id)).toEqual(expired);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json<Job>()).toMatchObject({
      status: 'published',
      enrollmentDeadline: '2026-10-13',
    });
  });

  it('CA-07 con un obligatorio pendiente y el plazo vencido → un único 400 con los dos details', async () => {
    const draft = await draftWithDeadline('2026-10-10', { location: undefined });

    const response = await publish(draft.id);

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { details: ErrorDetail[] } }>().error.details).toEqual([
      { field: 'location', message: 'Obligatorio para publicar.' },
      EXPIRED,
    ]);
    expect(await getJob(draft.id)).toEqual(draft);
  });

  it('S-01 publicar una ya publicada con el plazo vencido → 200 igual, sin cambios', async () => {
    clock.set('2026-10-01T10:00:00Z');
    const published = await createPublishedJob(app, { enrollmentDeadline: '2026-10-10' });
    clock.set('2026-10-13T10:00:00Z');

    const response = await publish(published.id);

    expect(response.statusCode).toBe(200);
    expect(response.json<Job>()).toEqual(published);
    expect(await getJob(published.id)).toEqual(published);
  });
});

describe('fecha límite — duplicar', () => {
  it('CA-08 duplicar una con 2026-10-20 → borrador con null; la original igual', async () => {
    const original = await createPublishedJob(app, { enrollmentDeadline: '2026-10-20' });
    expect(original.enrollmentDeadline).toBe('2026-10-20');

    const response = await app.inject({
      method: 'POST',
      url: `/api/jobs/${original.id}/duplicate`,
    });

    expect(response.statusCode).toBe(201);
    const copy = response.json<Job>();
    expect(copy).toMatchObject({
      status: 'draft',
      enrollmentDeadline: null,
      title: original.title,
    });
    expect(copy.id).not.toBe(original.id);
    const reread = await app.inject({ method: 'GET', url: `/api/jobs/${original.id}` });
    expect(reread.json<Job>()).toEqual(original);
    const copyRead = await app.inject({ method: 'GET', url: `/api/jobs/${copy.id}` });
    expect(copyRead.json<Job>().enrollmentDeadline).toBeNull();
  });
});
