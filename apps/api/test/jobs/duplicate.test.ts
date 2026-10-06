import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import {
  closeJob,
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Los casos hostiles (404, cuerpo, ID no válido, fallo de SQLite) van en la tarea adversarial.
const NOW = '2026-10-06T08:00:00.000Z';
const DUPLICATE_AT = '2026-10-07T09:00:00.000Z';

let app: FastifyInstance;
let clock: TestClock;

beforeEach(() => {
  clock = createTestClock(NOW);
  ({ app } = createTestApp({ now: clock.now }));
});

afterEach(async () => {
  await app.close();
});

function postDuplicate(id: number) {
  return app.inject({ method: 'POST', url: `/api/jobs/${id}/duplicate` });
}

async function getJob(id: number): Promise<Job> {
  const response = await app.inject({ method: 'GET', url: `/api/jobs/${id}` });
  return response.json<Job>();
}

function editable({ title, description, location, workMode, salaryMin, salaryMax }: Job) {
  return { title, description, location, workMode, salaryMin, salaryMax };
}

describe('POST /api/jobs/:id/duplicate — duplicar (camino feliz)', () => {
  it('CA-14/EC-28 duplicar una cerrada → 201 borrador; la original no cambia', async () => {
    const published = await createPublishedJob(app);
    const closed = await closeJob(app, published.id);
    clock.set(DUPLICATE_AT);

    const response = await postDuplicate(closed.id);

    expect(response.statusCode).toBe(201);
    const copy = response.json<Job>();
    expect(copy.id).not.toBe(closed.id);
    expect(editable(copy)).toEqual(editable(closed));
    expect(copy).toMatchObject({
      status: 'draft',
      createdAt: DUPLICATE_AT,
      publishedAt: null,
      closedAt: null,
    });
    expect(await getJob(closed.id)).toEqual(closed);
    expect(await getJob(copy.id)).toEqual(copy);
  });

  it('CA-15 duplicar un borrador y una publicada → borradores sin fechas', async () => {
    const draft = await createJob(app, {
      title: 'Analista de datos',
      description: 'Descripción inventada.',
      location: 'Sevilla',
      workMode: 'remota',
    });
    const published = await createPublishedJob(app);
    clock.set(DUPLICATE_AT);

    const fromDraft = (await postDuplicate(draft.id)).json<Job>();
    const fromPublished = (await postDuplicate(published.id)).json<Job>();

    for (const [copy, original] of [
      [fromDraft, draft],
      [fromPublished, published],
    ] as const) {
      expect(copy.id).not.toBe(original.id);
      expect(editable(copy)).toEqual(editable(original));
      expect(copy).toMatchObject({ status: 'draft', publishedAt: null, closedAt: null });
      expect(await getJob(original.id)).toEqual(original);
    }
  });

  it('EC-26 borrador con solo título y título de 120 se copian tal cual', async () => {
    const onlyTitle = await createJob(app, { title: 'Solo título' });
    const longTitle = await createJob(app, { title: 'T'.repeat(120) });

    const first = (await postDuplicate(onlyTitle.id)).json<Job>();
    const second = (await postDuplicate(longTitle.id)).json<Job>();

    expect(editable(first)).toEqual(editable(onlyTitle));
    expect(first).toMatchObject({ title: 'Solo título', description: null, location: null });
    expect(second.title).toBe('T'.repeat(120));
  });

  it('EC-31 dos duplicados → dos borradores', async () => {
    const original = await createPublishedJob(app);

    const first = (await postDuplicate(original.id)).json<Job>();
    const second = (await postDuplicate(original.id)).json<Job>();

    expect(new Set([original.id, first.id, second.id]).size).toBe(3);
    expect(first.status).toBe('draft');
    expect(second.status).toBe('draft');
    expect(await getJob(original.id)).toEqual(original);
  });
});
