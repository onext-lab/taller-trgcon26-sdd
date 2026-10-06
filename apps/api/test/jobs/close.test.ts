import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import {
  closeJob,
  createApplicationsSpy,
  createPublishedJob,
  createTestApp,
  createTestClock,
  type ApplicationsSpy,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Los casos hostiles (borrador, 404, cuerpo, fallo del puerto) van en la tarea adversarial.
const PUBLISH_AT = '2026-10-05T08:00:00.000Z';
const CLOSE_AT = '2026-10-06T22:30:00.000Z';
const ONE_HOUR_MS = 60 * 60 * 1000;

let app: FastifyInstance;
let clock: TestClock;
let spy: ApplicationsSpy;

beforeEach(() => {
  clock = createTestClock(PUBLISH_AT);
  spy = createApplicationsSpy();
  ({ app } = createTestApp({ now: clock.now, jobApplications: spy.port }));
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
