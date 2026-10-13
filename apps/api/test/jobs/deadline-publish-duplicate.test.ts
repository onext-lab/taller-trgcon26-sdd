import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { createPublishedJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. Reloj fijo en 2026-10-13; TASK-02 añade aquí CA-07 (publicar con plazo vencido).
let app: FastifyInstance;

beforeEach(() => {
  const clock = createTestClock('2026-10-13T10:00:00Z');
  ({ app } = createTestApp({ now: clock.now }));
});

afterEach(async () => {
  await app.close();
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
