import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { createJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. EC-50 (DT-05, DEC-11.8): C0 (U+0000-U+001F) y DEL (U+007F) → 400 en título y ubicación; en la
// descripción, todos salvo \n, \r y \t. Los caracteres de control van siempre como secuencias de escape.
const NOW = '2026-10-06T22:30:00.000Z';
const FORMAT_MESSAGE = 'Formato no válido.';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

function postJob(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/jobs', payload });
}

function patchJob(id: number, payload: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: `/api/jobs/${id}`, payload });
}

function countJobs(): number {
  return Number(db.prepare('SELECT COUNT(*) AS total FROM job_openings').get()?.total);
}

async function getJob(id: number): Promise<Job> {
  return (await app.inject({ method: 'GET', url: `/api/jobs/${id}` })).json<Job>();
}

interface ErrorBody {
  error: { code: string; details: { field: string; message: string }[] };
}

function expectRejected(response: { statusCode: number; json: <T>() => T }, field: string) {
  expect(response.statusCode).toBe(400);
  const { error } = response.json<ErrorBody>();
  expect(error.code).toBe('VALIDATION_ERROR');
  expect(error.details).toEqual([{ field, message: FORMAT_MESSAGE }]);
}

// Título de 6+ caracteres con un carácter de control al principio, en medio y al final.
const positions = (char: string) => [
  ['al principio', `${char}abcdef`],
  ['en medio', `a${char}bcdef`],
  ['al final', `abcdef${char}`],
];

describe('EC-50 alta: caracteres de control → 400 y no se crea nada', () => {
  it.each(positions('\u0000'))('EC-50 NUL %s del título', async (_where, title) => {
    expectRejected(await postJob({ title }), 'title');
    expect(countJobs()).toBe(0);
  });

  it.each(positions('\u0000'))('EC-50 NUL %s de la ubicación', async (_where, location) => {
    expectRejected(await postJob({ title: 'Analista de datos', location }), 'location');
    expect(countJobs()).toBe(0);
  });

  it.each(positions('\u0000'))('EC-50 NUL %s de la descripción', async (_where, description) => {
    expectRejected(await postJob({ title: 'Analista de datos', description }), 'description');
    expect(countJobs()).toBe(0);
  });

  it.each([
    ['U+0001', '\u0001'],
    ['U+001F', '\u001F'],
    ['U+007F (DEL)', '\u007F'],
    ['U+001B (ESC)', '\u001B'],
  ])('EC-50 %s se rechaza en título, ubicación y descripción', async (_name, char) => {
    expectRejected(await postJob({ title: `ab${char}cdef` }), 'title');
    expectRejected(
      await postJob({ title: 'Analista de datos', location: `Va${char}lencia` }),
      'location',
    );
    expectRejected(
      await postJob({ title: 'Analista de datos', description: `Texto${char}` }),
      'description',
    );
    expect(countJobs()).toBe(0);
  });

  it('EC-50 tabulador, salto de línea y retorno de carro en la descripción se aceptan y se guardan', async () => {
    const description = 'Funciones:\n\t- Cribar CV\r\n\t- Entrevistar';
    const response = await postJob({ title: 'Técnica/o de selección', description });

    expect(response.statusCode).toBe(201);
    expect(response.json<Job>().description).toBe(description);
    expect(countJobs()).toBe(1);
  });

  it.each([
    ['tabulador', 'ab\tcdef'],
    ['salto de línea', 'ab\ncdef'],
    ['retorno de carro', 'ab\rcdef'],
  ])('EC-50 %s en medio del título se rechaza', async (_name, title) => {
    expectRejected(await postJob({ title }), 'title');
    expect(countJobs()).toBe(0);
  });

  it('EC-50 tabulador y salto de línea en medio de la ubicación se rechazan', async () => {
    expectRejected(
      await postJob({ title: 'Analista de datos', location: 'Va\tlencia' }),
      'location',
    );
    expectRejected(
      await postJob({ title: 'Analista de datos', location: 'Va\nlencia' }),
      'location',
    );
    expect(countJobs()).toBe(0);
  });

  it('EC-50 el mensaje no repite el valor recibido', async () => {
    const response = await postJob({ title: 'a\u0000bcdef' });

    expect(response.body).not.toContain('bcdef');
    expect(response.body).not.toContain('\u0000');
  });

  it('EC-50 un NUL no provoca 500: 400 también con título de longitud mínima', async () => {
    expectRejected(await postJob({ title: 'a\u0000b' }), 'title');
    expect(countJobs()).toBe(0);
  });
});

describe('EC-50 edición: caracteres de control → 400 y la oferta no cambia', () => {
  let original: Job;

  beforeEach(async () => {
    original = await createJob(app, {
      title: 'Desarrollador/a backend',
      description: 'Descripción inicial',
      location: 'Valencia',
    });
  });

  it.each(positions('\u0000'))('EC-50 NUL %s del título', async (_where, title) => {
    expectRejected(await patchJob(original.id, { title }), 'title');
    expect(await getJob(original.id)).toEqual(original);
  });

  it.each(positions('\u0000'))('EC-50 NUL %s de la ubicación', async (_where, location) => {
    expectRejected(await patchJob(original.id, { location }), 'location');
    expect(await getJob(original.id)).toEqual(original);
  });

  it.each(positions('\u0000'))('EC-50 NUL %s de la descripción', async (_where, description) => {
    expectRejected(await patchJob(original.id, { description }), 'description');
    expect(await getJob(original.id)).toEqual(original);
  });

  it.each([
    ['U+0001', '\u0001'],
    ['U+001F', '\u001F'],
    ['U+007F (DEL)', '\u007F'],
  ])('EC-50 %s se rechaza en la edición', async (_name, char) => {
    expectRejected(await patchJob(original.id, { title: `ab${char}cdef` }), 'title');
    expectRejected(await patchJob(original.id, { location: `Va${char}lencia` }), 'location');
    expectRejected(await patchJob(original.id, { description: `Texto${char}` }), 'description');
    expect(await getJob(original.id)).toEqual(original);
  });

  it('EC-50 tabulador y salto de línea en la descripción se aceptan al editar', async () => {
    const description = 'Línea 1\n\tLínea 2\r\nLínea 3';
    const response = await patchJob(original.id, { description });

    expect(response.statusCode).toBe(200);
    expect(response.json<Job>().description).toBe(description);
  });

  it('EC-50 tabulador y salto de línea en medio del título se rechazan al editar', async () => {
    expectRejected(await patchJob(original.id, { title: 'ab\tcdef' }), 'title');
    expectRejected(await patchJob(original.id, { title: 'ab\ncdef' }), 'title');
    expect(await getJob(original.id)).toEqual(original);
  });

  it('EC-50 tras los rechazos no hay filas nuevas ni cambios en la base', async () => {
    await patchJob(original.id, { title: 'a\u0000bcdef' });
    await postJob({ title: 'abcdef\u0000' });

    expect(countJobs()).toBe(1);
    expect(await getJob(original.id)).toEqual(original);
  });
});
