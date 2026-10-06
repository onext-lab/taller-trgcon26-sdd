import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import type { DatabaseSync } from 'node:sqlite';
import {
  createJob,
  createTestApp,
  createTestClock,
  failWrites,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Los casos hostiles del PATCH (título vacío, solo lectura, banda con el valor guardado, fallo de
// SQLite, oferta borrada, ID no válido) van en TASK-06 y TASK-07.
const NOW = '2026-10-06T22:30:00.000Z';
const ONE_HOUR_MS = 60 * 60 * 1000;

let app: FastifyInstance;
let db: DatabaseSync;
let clock: TestClock;

beforeEach(() => {
  clock = createTestClock(NOW);
  ({ app, db } = createTestApp({ now: clock.now }));
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

// ---- TASK-06 [adversarial]: entradas hostiles, banda fusionada y fallos ----

type ErrorBody = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};

describe('PATCH /api/jobs/:id — entradas hostiles (CA-12, EC-20, EC-25)', () => {
  it('CA-12/EC-20 título vacío, de 2 o modalidad inválida → 400 sin cambios', async () => {
    const created = await createJob(app, { title: 'Responsable de nóminas', workMode: 'remota' });
    const cases: [string, Record<string, unknown>][] = [
      ['title', { title: '' }],
      ['title', { title: '   ' }],
      ['title', { title: 'ab' }],
      ['title', { title: null }],
      ['workMode', { workMode: 'teletrabajo' }],
    ];

    for (const [field, patch] of cases) {
      const response = await patchJob(created.id, patch);

      expect(response.statusCode).toBe(400);
      const { error } = response.json<ErrorBody>();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details?.map((detail) => detail.field)).toContain(field);
      expect(response.body).not.toContain('teletrabajo');
      expect((await getJob(created.id)).json()).toEqual(created);
    }
  });

  it('RF-02 mínimo nuevo mayor que el máximo guardado → 400 en salaryMin', async () => {
    const created = await createJob(app, {
      title: 'Contable sénior',
      salaryMin: 32000,
      salaryMax: 40000,
    });

    const response = await patchJob(created.id, { salaryMin: 45000 });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [
          { field: 'salaryMin', message: 'El salario mínimo no puede ser mayor que el máximo.' },
        ],
      },
    });
    expect((await getJob(created.id)).json()).toEqual(created);
  });

  it.each<[string, unknown]>([
    ['status', 'published'],
    ['createdAt', '2020-01-01T00:00:00.000Z'],
    ['id', 99],
  ])('EC-25 PATCH con %s → 400 sin cambios', async (field, value) => {
    const created = await createJob(app, { title: 'Analista de datos junior' });

    const response = await patchJob(created.id, { title: 'Otro título válido', [field]: value });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field, message: 'Campo no permitido.' }],
      },
    });
    expect((await getJob(created.id)).json()).toEqual(created);
  });

  it('el orden de comprobación es validar antes que buscar: título inválido a un ID inexistente → 400', async () => {
    const response = await patchJob(9999, { title: 'ab' });

    expect(response.statusCode).toBe(400);
    expect(response.json<ErrorBody>().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/jobs/:id — fallos de dependencia y concurrencia (EC-22, EC-24, EC-30)', () => {
  it('EC-22 fallo de SQLite al editar → 500 sin cambios', async () => {
    const created = await createJob(app, { title: 'Técnica/o de selección', location: 'Sevilla' });
    failWrites(db, 'UPDATE');

    const response = await patchJob(created.id, { location: 'Granada' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
    });
    expect(response.body).not.toContain('fallo simulado');
    expect(response.body).not.toContain('SQLITE');
    expect((await getJob(created.id)).json()).toEqual(created);
  });

  it('EC-24/EC-30 PATCH de una oferta borrada → 404', async () => {
    const created = await createJob(app, { title: 'Administrativo/a de RR. HH.' });
    const removed = await app.inject({ method: 'DELETE', url: `/api/jobs/${created.id}` });
    expect(removed.statusCode).toBe(204);

    const response = await patchJob(created.id, { title: 'Título nuevo válido' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'La oferta no existe.' },
    });
  });
});
