import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJob, createTestApp, createTestClock, type TestClock } from '../helpers/test-app.ts';

// Datos inventados. «No se crea nada» = `SELECT COUNT(*) FROM job_openings` sigue a 0.
const NOW = '2026-10-06T22:30:00.000Z';
const SALARY_RANGE_MESSAGE = 'El salario mínimo no puede ser mayor que el máximo.';

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

function postJob(payload: unknown) {
  return app.inject({ method: 'POST', url: '/api/jobs', payload: payload as object });
}

function countJobs(): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM job_openings').get();
  return Number(row?.total);
}

/** Espera un 400 VALIDATION_ERROR con `field` en `details` y sin ninguna fila creada. */
async function expectRejected(payload: unknown, field: string): Promise<string | undefined> {
  const response = await postJob(payload);
  expect(response.statusCode).toBe(400);
  const { error } = response.json<{
    error: { code: string; details: { field: string; message: string }[] };
  }>();
  expect(error.code).toBe('VALIDATION_ERROR');
  const detail = error.details.find((item) => item.field === field);
  expect(detail).toBeDefined();
  expect(countJobs()).toBe(0);
  return detail?.message;
}

describe('POST /api/jobs — alta de borradores (camino feliz)', () => {
  it('CA-01 solo el título → 201 en draft con createdAt del reloj', async () => {
    const response = await postJob({ title: 'Desarrollador/a backend (Node.js)' });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: 1,
      title: 'Desarrollador/a backend (Node.js)',
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
    expect(countJobs()).toBe(1);
  });

  it('CA-02/EC-03 recorta y guarda todos los campos', async () => {
    const job = await createJob(app, {
      title: '  Técnica/o de selección  ',
      description: '\n  Gestión de procesos de selección de perfiles técnicos.  \t',
      location: '  Valencia ',
      workMode: 'híbrida',
      salaryMin: 32000,
      salaryMax: 40000,
    });

    expect(job).toMatchObject({
      title: 'Técnica/o de selección',
      description: 'Gestión de procesos de selección de perfiles técnicos.',
      location: 'Valencia',
      workMode: 'híbrida',
      salaryMin: 32000,
      salaryMax: 40000,
      status: 'draft',
      createdAt: NOW,
    });
    const row = db.prepare('SELECT * FROM job_openings WHERE id = ?').get(job.id);
    expect(row).toMatchObject({
      title: 'Técnica/o de selección',
      description: 'Gestión de procesos de selección de perfiles técnicos.',
      location: 'Valencia',
      work_mode: 'híbrida',
      salary_min: 32000,
      salary_max: 40000,
      status: 'draft',
      created_at: NOW,
    });
  });
});

describe('POST /api/jobs — vacíos, caracteres e idempotencia', () => {
  it.each([
    ['vacías', ''],
    ['de espacios', '   \t '],
  ])('RF-01 descripción y ubicación %s se guardan como null', async (_case, blank) => {
    const job = await createJob(app, {
      title: 'Analista de datos junior',
      description: blank,
      location: blank,
    });

    expect(job.description).toBeNull();
    expect(job.location).toBeNull();
    const row = db.prepare('SELECT description, location FROM job_openings').get();
    expect(row).toEqual({ description: null, location: null });
  });

  it('EC-04 tildes, eñes y emoji; cuenta caracteres, no bytes', async () => {
    const job = await createJob(app, { title: 'Diseñador/a UX 🎨', location: 'A Coruña' });
    expect(job.title).toBe('Diseñador/a UX 🎨');
    expect(job.location).toBe('A Coruña');

    const longest = await createJob(app, { title: '🎨'.repeat(120) });
    expect(longest.title).toBe('🎨'.repeat(120));
    expect(countJobs()).toBe(2);

    const response = await postJob({ title: '🎨'.repeat(121) });
    expect(response.statusCode).toBe(400);
    expect(countJobs()).toBe(2);
  });

  it('EC-06/EC-09 dos POST iguales crean dos borradores', async () => {
    // DT-03: sin clave natural no hay idempotencia.
    const body = { title: 'Responsable de nóminas', location: 'Zaragoza' };
    const first = await createJob(app, body);
    clock.advance(1000);
    const second = await createJob(app, body);

    expect(second.id).not.toBe(first.id);
    expect(second.createdAt).toBe('2026-10-06T22:30:01.000Z');
    expect(countJobs()).toBe(2);
  });
});

describe('POST /api/jobs — fronteras de longitud (CA-03, CA-04, CA-06)', () => {
  it.each<[string, Record<string, unknown>, string]>([
    ['título ausente', {}, 'title'],
    ['título de espacios', { title: '   ' }, 'title'],
    ['título de 2', { title: 'ab' }, 'title'],
    ['título de 121', { title: 'a'.repeat(121) }, 'title'],
    ['descripción de 5 001', { title: 'Oferta', description: 'a'.repeat(5001) }, 'description'],
    ['ubicación de 1 tras recortar', { title: 'Oferta', location: '  M  ' }, 'location'],
    [
      'ubicación de 121 tras recortar',
      { title: 'Oferta', location: ` ${'a'.repeat(121)} ` },
      'location',
    ],
  ])('%s → 400 sin crear nada', async (_case, payload, field) => {
    await expectRejected(payload, field);
  });

  it.each<[string, Record<string, unknown>]>([
    ['título de 3', { title: 'abc' }],
    ['título de 120', { title: 'a'.repeat(120) }],
    ['descripción de 5 000', { title: 'Oferta', description: 'a'.repeat(5000) }],
    ['ubicación de 2 tras recortar', { title: 'Oferta', location: '  Bi ' }],
    ['ubicación de 120 tras recortar', { title: 'Oferta', location: ` ${'a'.repeat(120)} ` }],
  ])('%s → 201', async (_case, payload) => {
    const response = await postJob(payload);
    expect(response.statusCode).toBe(201);
    expect(countJobs()).toBe(1);
  });

  it('el título de 2 da el mensaje de minLength', async () => {
    const message = await expectRejected({ title: 'ab' }, 'title');
    expect(message).toBe('Debe tener al menos 3 caracteres.');
  });
});

describe('POST /api/jobs — modalidad (CA-05, EC-10)', () => {
  it.each(['teletrabajo', 'Híbrida', 'hibrida', ' híbrida'])(
    'modalidad %j fuera de los literales → 400',
    async (workMode) => {
      const message = await expectRejected({ title: 'Oferta', workMode }, 'workMode');
      expect(message).toBe('Debe ser uno de estos valores: presencial, híbrida, remota.');
    },
  );

  it('los tres literales se aceptan', async () => {
    for (const workMode of ['presencial', 'híbrida', 'remota']) {
      const job = await createJob(app, { title: 'Oferta', workMode });
      expect(job.workMode).toBe(workMode);
    }
    expect(countJobs()).toBe(3);
  });
});

describe('POST /api/jobs — rango salarial (CA-07, EC-13)', () => {
  it.each<[string, Record<string, unknown>]>([
    ['solo mínimo', { salaryMin: 45000 }],
    ['solo máximo', { salaryMax: 40000 }],
    ['iguales', { salaryMin: 40000, salaryMax: 40000 }],
  ])('CA-07/EC-13 %s → 201', async (_case, salaries) => {
    const job = await createJob(app, { title: 'Contable sénior', ...salaries });
    expect(job.salaryMin).toBe(salaries.salaryMin ?? null);
    expect(job.salaryMax).toBe(salaries.salaryMax ?? null);
  });

  it('CA-07 mínimo mayor que el máximo → 400 en salaryMin', async () => {
    const response = await postJob({
      title: 'Contable sénior',
      salaryMin: 45000,
      salaryMax: 40000,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field: 'salaryMin', message: SALARY_RANGE_MESSAGE }],
      },
    });
    expect(countJobs()).toBe(0);
  });
});
