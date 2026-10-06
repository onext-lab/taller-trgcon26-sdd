import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, createTestClock, failWrites } from '../helpers/test-app.ts';

// TASK-06 [adversarial]: entradas hostiles y fallos de SQLite en POST /api/jobs. Datos inventados.
// «No se crea nada» = `SELECT COUNT(*) FROM job_openings` sigue a 0.
const NOW = '2026-10-06T22:30:00.000Z';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  const clock = createTestClock(NOW);
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

const GENERIC_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};

function postRaw(payload: string) {
  return app.inject({
    method: 'POST',
    url: '/api/jobs',
    headers: { 'content-type': 'application/json' },
    payload,
  });
}

describe('POST /api/jobs — cuerpos que no son un objeto JSON (EC-01)', () => {
  it('EC-01 cuerpo no JSON, [] o "x" → 400 sin filas', async () => {
    const notJson = await postRaw('no es json');
    expect(notJson.statusCode).toBe(400);
    expect(notJson.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'El cuerpo de la petición no es JSON válido.',
        details: [{ field: 'body', message: 'Debe ser un objeto JSON.' }],
      },
    });

    for (const raw of ['[]', '"x"']) {
      const response = await postRaw(raw);
      expect(response.statusCode).toBe(400);
      const { error } = response.json<{
        error: { code: string; details: { field: string; message: string }[] };
      }>();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual([{ field: 'body', message: 'Debe ser un objeto JSON.' }]);
    }

    const empty = await postRaw('');
    expect(empty.statusCode).toBe(400);
    expect(empty.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
    expect(countJobs()).toBe(0);
  });
});

describe('POST /api/jobs — mass assignment (CA-08, EC-02)', () => {
  it.each<[string, unknown]>([
    ['status', 'published'],
    ['createdAt', '2020-01-01T00:00:00.000Z'],
    ['id', 99],
  ])('CA-08/EC-02 campo %s → 400 con el campo en details', async (field, value) => {
    const response = await postJob({ title: 'Oferta inventada', [field]: value });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field, message: 'Campo no permitido.' }],
      },
    });
    expect(countJobs()).toBe(0);
  });

  it('CA-08/EC-02 clave no declarada foo → 400 sin nombrarla (DEC-11.4)', async () => {
    const response = await postJob({ title: 'Oferta inventada', foo: 'bar' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field: 'body', message: 'Hay campos no permitidos.' }],
      },
    });
    expect(response.body).not.toContain('foo');
    expect(countJobs()).toBe(0);
  });
});

describe('POST /api/jobs — fallos de SQLite y datos hostiles (EC-05, EC-08)', () => {
  it('EC-05 fallo de SQLite al insertar → 500 sin stack y sin filas', async () => {
    failWrites(db, 'INSERT');

    const response = await postJob({ title: 'Oferta inventada' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(GENERIC_ERROR);
    expect(response.body).not.toContain('fallo simulado');
    expect(response.body).not.toContain('SQLITE');
    expect(response.body).not.toContain('stack');
    expect(countJobs()).toBe(0);
  });

  it('EC-08 inyección SQL se guarda literal y la tabla sigue', async () => {
    const title = "'); DROP TABLE job_openings; --";

    const response = await postJob({ title });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ title: string }>().title).toBe(title);
    expect(db.prepare('SELECT title FROM job_openings').get()).toEqual({ title });
    const list = await app.inject({ method: 'GET', url: '/api/jobs' });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ total: number }>().total).toBe(1);
  });
});

describe('POST /api/jobs — banda salarial inválida (CA-07, EC-11)', () => {
  // "40000" es texto: prueba que coerceTypes está desactivado (DEC-11). 1e300 es DD-12.
  const invalidValues: unknown[] = ['40000', 40000.5, 0, -1, 1e300];

  it.each(['salaryMin', 'salaryMax'])(
    'CA-07/EC-11 %s no válido → 400 en ese extremo',
    async (field) => {
      for (const value of invalidValues) {
        const response = await postJob({ title: 'Oferta inventada', [field]: value });

        expect(response.statusCode).toBe(400);
        const { error } = response.json<{
          error: { code: string; details: { field: string; message: string }[] };
        }>();
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.details.map((detail) => detail.field)).toContain(field);
        expect(response.body).not.toContain('40000.5');
        expect(response.body).not.toContain('1e+300');
        expect(countJobs()).toBe(0);
      }
    },
  );
});

describe('POST /api/jobs — cuerpos enormes (EC-17)', () => {
  it('EC-17 descripción de 1 MB → 400; > 1 MiB → 413', async () => {
    const big = await postJob({ title: 'Oferta inventada', description: 'a'.repeat(1_000_000) });
    expect(big.statusCode).toBe(400);
    const { error } = big.json<{ error: { code: string; details: { field: string }[] } }>();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.map((detail) => detail.field)).toContain('description');
    expect(big.body.length).toBeLessThan(2000);
    expect(countJobs()).toBe(0);

    const huge = await postRaw(
      JSON.stringify({ title: 'Oferta inventada', description: 'a'.repeat(1_048_576) }),
    );
    expect(huge.statusCode).toBe(413);
    expect(huge.json()).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'El cuerpo de la petición es demasiado grande.',
      },
    });
    expect(countJobs()).toBe(0);
  });
});
