import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { createJob, createTestApp, createTestClock, type TestClock } from '../helpers/test-app.ts';

// Datos inventados. Los casos hostiles del PATCH (título vacío, solo lectura, banda con el valor guardado, fallo de
// SQLite, oferta borrada, ID no válido) van en TASK-06 y TASK-07.
const NOW = '2026-10-06T22:30:00.000Z';
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

function getJob(id: number) {
  return app.inject({ method: 'GET', url: `/api/jobs/${id}` });
}

describe('PATCH /api/jobs/:id — edición (camino feliz)', () => {
  it('CA-09 cambia descripción y ubicación; sigue en draft y createdAt igual', async () => {
    const created = await createJob(app, {
      title: 'Desarrollador/a backend',
      description: 'Descripción inicial inventada.',
      location: 'Zaragoza',
      workMode: 'presencial',
      salaryMin: 30000,
      salaryMax: 38000,
    });
    clock.advance(ONE_HOUR_MS);

    const response = await patchJob(created.id, {
      description: '  Nueva descripción inventada.  ',
      location: 'Bilbao',
    });

    expect(response.statusCode).toBe(200);
    const expected: Job = {
      ...created,
      description: 'Nueva descripción inventada.',
      location: 'Bilbao',
    };
    expect(response.json()).toEqual(expected);
    expect(response.json<Job>().status).toBe('draft');
    expect(response.json<Job>().createdAt).toBe(NOW);
    expect((await getJob(created.id)).json()).toEqual(expected);
  });

  it('CA-10/EC-21 vaciar la descripción → null', async () => {
    const created = await createJob(app, {
      title: 'Administrativo/a de RR. HH.',
      description: 'Texto inventado que se vaciará.',
    });

    const withEmpty = await patchJob(created.id, { description: '' });
    expect(withEmpty.statusCode).toBe(200);
    expect(withEmpty.json<Job>().description).toBeNull();

    await patchJob(created.id, { description: 'Otra vez con texto.' });
    const withNull = await patchJob(created.id, { description: null });
    expect(withNull.statusCode).toBe(200);
    expect(withNull.json<Job>().description).toBeNull();
    expect((await getJob(created.id)).json<Job>().description).toBeNull();
  });

  it('CA-11/EC-23 gana la última escritura, campo a campo', async () => {
    const created = await createJob(app, { title: 'Técnica/o de selección', location: 'Sevilla' });

    const first = await patchJob(created.id, { location: 'Granada' });
    const second = await patchJob(created.id, { workMode: 'remota' });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    // Campos distintos: se suman.
    expect(second.json()).toMatchObject({ location: 'Granada', workMode: 'remota' });

    const third = await patchJob(created.id, { location: 'Córdoba' });
    const fourth = await patchJob(created.id, { location: 'Almería' });
    expect(third.statusCode).toBe(200);
    expect(fourth.statusCode).toBe(200);
    // Mismo campo: gana el segundo.
    expect((await getJob(created.id)).json()).toMatchObject({
      title: 'Técnica/o de selección',
      location: 'Almería',
      workMode: 'remota',
    });
  });

  it('EC-19 PATCH {} → 400', async () => {
    const created = await createJob(app, { title: 'Responsable de nóminas' });

    const response = await patchJob(created.id, {});

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field: 'body', message: 'Envía al menos un campo.' }],
      },
    });
    expect((await getJob(created.id)).json()).toEqual(created);
  });

  it('EC-26 el mismo PATCH dos veces → 200 igual', async () => {
    const created = await createJob(app, { title: 'Analista de datos de personas' });
    const patch = { title: 'Analista de people analytics', salaryMin: 28000, salaryMax: 34000 };

    const first = await patchJob(created.id, patch);
    const second = await patchJob(created.id, patch);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(second.json()).toMatchObject(patch);
  });
});
