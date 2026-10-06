import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import {
  createJob,
  createTestApp,
  createTestClock,
  publishJob,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Los casos hostiles (cuerpo, ID no válido, campos pendientes, 409, 404, fallo de SQLite) van en
// la tarea adversarial.
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
