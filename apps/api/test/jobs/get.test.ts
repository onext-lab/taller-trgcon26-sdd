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
      enrollmentDeadline: null,
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
      enrollmentDeadline: null,
    });
    // Los opcionales salen como `null`, nunca ausentes.
    for (const key of ['description', 'location', 'workMode', 'salaryMin', 'salaryMax']) {
      expect(Object.hasOwn(job, key)).toBe(true);
    }
  });
});

describe('GET /api/jobs/:id — adversarial', () => {
  it('CA-20 ID inexistente → 404 sin datos', async () => {
    await createJob(app, { title: 'Otra oferta inventada' });

    const response = await getJob(999999999);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'La oferta no existe.' },
    });
  });

  it.each(['abc', '1.5', '0', '007'])('EC-43 ID no entero %s → 400', async (id) => {
    const response = await app.inject({ method: 'GET', url: `/api/jobs/${id}` });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field: 'id', message: 'Formato no válido.' }],
      },
    });
  });

  it('EC-46 GET tras borrado → 404', async () => {
    const created = await createJob(app, { title: 'Oferta efímera' });

    expect(
      (await app.inject({ method: 'DELETE', url: `/api/jobs/${created.id}` })).statusCode,
    ).toBe(204);
    const response = await getJob(created.id);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'La oferta no existe.' },
    });
  });
});
