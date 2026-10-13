import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { createPublishedJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. Reloj fijo en 2026-10-13; sin validación de día ni de «no anterior a hoy» (TASK-02).
const TITLE = 'Analista de datos junior';

let app: FastifyInstance;

beforeEach(() => {
  const clock = createTestClock('2026-10-13T10:00:00Z');
  ({ app } = createTestApp({ now: clock.now }));
});

afterEach(async () => {
  await app.close();
});

function post(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/jobs', payload });
}

function patch(id: number, payload: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: `/api/jobs/${id}`, payload });
}

async function getJob(id: number): Promise<Job> {
  const response = await app.inject({ method: 'GET', url: `/api/jobs/${id}` });
  expect(response.statusCode).toBe(200);
  return response.json<Job>();
}

describe('fecha límite — alta y detalle', () => {
  it('CA-01 alta con 2026-10-13, con 2036-10-13 y sin fecha → 201 draft con la fecha o null', async () => {
    const cases: [Record<string, unknown>, string | null][] = [
      [{ title: TITLE, enrollmentDeadline: '2026-10-13' }, '2026-10-13'],
      [{ title: TITLE, enrollmentDeadline: '2036-10-13' }, '2036-10-13'],
      [{ title: TITLE }, null],
    ];
    for (const [payload, expected] of cases) {
      const response = await post(payload);

      expect(response.statusCode).toBe(201);
      const created = response.json<Job>();
      expect(created).toMatchObject({ status: 'draft', enrollmentDeadline: expected });
      expect((await getJob(created.id)).enrollmentDeadline).toBe(expected);
    }
  });

  it('CA-01 alta con enrollmentDeadline null explícito → 201 con null', async () => {
    const response = await post({ title: TITLE, enrollmentDeadline: null });

    expect(response.statusCode).toBe(201);
    expect(response.json<Job>().enrollmentDeadline).toBeNull();
  });
});

describe('fecha límite — edición', () => {
  it('CA-03 published 2026-10-20 → 15/10, 30/11 y null: 200, mismo estado y fechas', async () => {
    const published = await createPublishedJob(app, { enrollmentDeadline: '2026-10-20' });
    expect(published.enrollmentDeadline).toBe('2026-10-20');

    for (const next of ['2026-10-15', '2026-11-30', null]) {
      const response = await patch(published.id, { enrollmentDeadline: next });

      expect(response.statusCode).toBe(200);
      const updated = response.json<Job>();
      expect(updated.enrollmentDeadline).toBe(next);
      expect(updated).toMatchObject({
        status: 'published',
        createdAt: published.createdAt,
        publishedAt: published.publishedAt,
        closedAt: published.closedAt,
      });
      expect(await getJob(published.id)).toEqual(updated);
    }
  });

  it('CA-03 un PATCH de otro campo no toca la fecha límite', async () => {
    const created = (await post({ title: TITLE, enrollmentDeadline: '2026-10-20' })).json<Job>();

    const response = await patch(created.id, { title: 'Analista de datos senior' });

    expect(response.statusCode).toBe(200);
    expect(response.json<Job>()).toMatchObject({
      title: 'Analista de datos senior',
      enrollmentDeadline: '2026-10-20',
    });
  });

  it('EC-03 "" y espacios → null en alta y edición', async () => {
    for (const blank of ['', '   ']) {
      const created = await post({ title: TITLE, enrollmentDeadline: blank });
      expect(created.statusCode).toBe(201);
      expect(created.json<Job>().enrollmentDeadline).toBeNull();
    }
    const withDeadline = (
      await post({ title: TITLE, enrollmentDeadline: '2026-10-20' })
    ).json<Job>();

    for (const blank of ['', '   ']) {
      await patch(withDeadline.id, { enrollmentDeadline: '2026-10-20' });
      const response = await patch(withDeadline.id, { enrollmentDeadline: blank });

      expect(response.statusCode).toBe(200);
      expect(response.json<Job>().enrollmentDeadline).toBeNull();
    }
  });

  it('EC-05 dos ediciones seguidas: gana la última', async () => {
    const created = (await post({ title: TITLE })).json<Job>();

    const first = await patch(created.id, { enrollmentDeadline: '2026-10-20' });
    const second = await patch(created.id, { enrollmentDeadline: '2026-11-05' });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect((await getJob(created.id)).enrollmentDeadline).toBe('2026-11-05');
  });
});
