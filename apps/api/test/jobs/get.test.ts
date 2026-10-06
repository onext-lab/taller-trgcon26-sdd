import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. Los casos hostiles de la ficha (ID no válido, inexistente) van en TASK-07.
const NOW = '2026-10-06T22:30:00.000Z';

let app: FastifyInstance;

beforeEach(() => {
  ({ app } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

function getJob(id: number) {
  return app.inject({ method: 'GET', url: `/api/jobs/${id}` });
}

describe('GET /api/jobs/:id — ficha (camino feliz)', () => {
  it('CA-19/EC-48 todos los campos y el HTML tal cual', async () => {
    const description = 'Equipo <b>pequeño</b>. <script>alert("x")</script> Sin sanear en la API.';
    const created = await createJob(app, {
      title: 'Oferta <b>X</b>',
      description,
      location: 'Málaga',
      workMode: 'remota',
      salaryMin: 30000,
      salaryMax: 36000,
    });

    const response = await getJob(created.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: created.id,
      title: 'Oferta <b>X</b>',
      description,
      location: 'Málaga',
      workMode: 'remota',
      salaryMin: 30000,
      salaryMax: 36000,
      status: 'draft',
      createdAt: NOW,
      publishedAt: null,
      closedAt: null,
    });
  });

  it('EC-44 solo título → opcionales null', async () => {
    const created = await createJob(app, { title: 'Auxiliar administrativo/a' });

    const response = await getJob(created.id);

    expect(response.statusCode).toBe(200);
    const job = response.json<Record<string, unknown>>();
    expect(job).toEqual({
      id: created.id,
      title: 'Auxiliar administrativo/a',
      description: null,
      location: null,
      workMode: null,
      salaryMin: null,
      salaryMax: null,
      status: 'draft',
      createdAt: NOW,
      publishedAt: null,
      closedAt: null,
    });
    // Los opcionales salen como `null`, nunca ausentes.
    for (const key of ['description', 'location', 'workMode', 'salaryMin', 'salaryMax']) {
      expect(Object.hasOwn(job, key)).toBe(true);
    }
  });
});
