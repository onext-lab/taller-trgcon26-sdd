import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorDetail } from '../../src/errors.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import {
  closeJob,
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
  failWrites,
  type TestClock,
} from '../helpers/test-app.ts';

// [adversarial] RF-01 (QUALITY-GATES § 3): categorías 1 Input inválido, 2 Boundary, 3 Fallo de dependencia y
// 6 Seguridad. Reloj 2026-10-13 10:00Z (Madrid 12:00). Datos inventados.
const TITLE = 'Analista de datos junior';
const INVALID_DATE = 'Introduce una fecha válida.';
const PAST_DATE = 'La fecha límite no puede ser anterior a hoy.';

let app: FastifyInstance;
let db: DatabaseSync;
let clock: TestClock;

beforeEach(() => {
  clock = createTestClock('2026-10-13T10:00:00Z');
  ({ app, db } = createTestApp({ now: clock.now }));
});

afterEach(async () => {
  await app.close();
});

function post(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/jobs', payload });
}

function patch(id: number, payload: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: `/api/jobs/${id}`, payload });
}

async function getJob(id: number): Promise<Job> {
  const response = await app.inject({ method: 'GET', url: `/api/jobs/${id}` });
  expect(response.statusCode).toBe(200);
  return response.json<Job>();
}

function countJobs(): number {
  return Number(db.prepare('SELECT COUNT(*) AS total FROM job_openings').get()?.total);
}

function detailsOf(response: LightMyRequestResponse): ErrorDetail[] {
  return response.json<{ error: { details: ErrorDetail[] } }>().error.details;
}

/** 400 `VALIDATION_ERROR` con un único detalle en `enrollmentDeadline`; `sent` no aparece en ningún punto del cuerpo. */
function expectDeadlineError(response: LightMyRequestResponse, message: string, sent?: string) {
  expect(response.statusCode).toBe(400);
  expect(response.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
  expect(detailsOf(response)).toEqual([{ field: 'enrollmentDeadline', message }]);
  if (sent !== undefined) expect(response.body).not.toContain(sent);
}

const HOSTILE = [
  '2026-02-31',
  '13/10/2026',
  '2026-10-13T00:00:00Z',
  '<script>alert(1)</script>',
  "' OR 1=1 --",
];

describe('RF-01 fecha límite adversarial — input inválido y seguridad (categorías 1 y 6)', () => {
  it.each(HOSTILE)(
    'EC-01/EC-07 %s → 400 sin repetir el valor y sin escribir (alta)',
    async (value) => {
      const response = await post({ title: TITLE, enrollmentDeadline: value });

      expectDeadlineError(response, INVALID_DATE, value);
      expect(countJobs()).toBe(0);
    },
  );

  it.each(HOSTILE)(
    'EC-01/EC-07 %s → 400 sin repetir el valor y sin escribir (edición)',
    async (value) => {
      const draft = await createJob(app, { title: TITLE, enrollmentDeadline: '2026-10-20' });

      const response = await patch(draft.id, { enrollmentDeadline: value });

      expectDeadlineError(response, INVALID_DATE, value);
      expect(await getJob(draft.id)).toEqual(draft);
      expect(countJobs()).toBe(1);
    },
  );

  it('EC-07 tras el ataque la tabla sigue intacta (sentencias preparadas)', async () => {
    const draft = await createJob(app, { title: TITLE });

    await patch(draft.id, { enrollmentDeadline: "'; DROP TABLE job_openings; --" });

    expect(countJobs()).toBe(1);
    expect(await getJob(draft.id)).toEqual(draft);
  });

  it('EC-01 un número → 400 «Debe ser un texto.» en alta y edición', async () => {
    const draft = await createJob(app, { title: TITLE });

    const created = await post({ title: TITLE, enrollmentDeadline: 20261013 });
    const edited = await patch(draft.id, { enrollmentDeadline: 20261013 });

    for (const response of [created, edited]) {
      expectDeadlineError(response, 'Debe ser un texto.', '20261013');
    }
    expect(countJobs()).toBe(1);
    expect(await getJob(draft.id)).toEqual(draft);
  });

  it('EC-01 más de 32 caracteres → 400 «Debe tener como máximo 32 caracteres.» (abuso de tamaño)', async () => {
    const huge = '2026-10-20'.padEnd(33, '0');
    const draft = await createJob(app, { title: TITLE });

    const created = await post({ title: TITLE, enrollmentDeadline: huge });
    const edited = await patch(draft.id, { enrollmentDeadline: huge });

    for (const response of [created, edited]) {
      expectDeadlineError(response, 'Debe tener como máximo 32 caracteres.', huge);
    }
    expect(countJobs()).toBe(1);
    expect(await getJob(draft.id)).toEqual(draft);
  });
});

describe('RF-01 fecha límite adversarial — fallo de dependencia (categoría 3)', () => {
  it('EC-04 falla el UPDATE de enrollment_deadline → 500 y la oferta igual', async () => {
    const draft = await createJob(app, { title: TITLE, enrollmentDeadline: '2026-10-20' });
    failWrites(db, 'UPDATE', { column: 'enrollment_deadline' });

    const response = await patch(draft.id, { enrollmentDeadline: '2026-10-25' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
    });
    expect(response.body).not.toContain('fallo simulado');
    expect(response.body).not.toContain('SQLITE');
    expect(await getJob(draft.id)).toEqual(draft);
  });
});

describe('RF-01 fecha límite adversarial — boundary (categoría 2)', () => {
  it('EC-09 closed: cambiar o quitar la fecha → 409 INVALID_TRANSITION y la oferta igual', async () => {
    const published = await createPublishedJob(app, { enrollmentDeadline: '2026-10-20' });
    const closed = await closeJob(app, published.id);

    for (const enrollmentDeadline of ['2026-11-30', null]) {
      const response = await patch(closed.id, { enrollmentDeadline });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: { code: 'INVALID_TRANSITION', message: 'Una oferta cerrada no se puede editar.' },
      });
      expect(await getJob(closed.id)).toEqual(closed);
    }
  });

  it('Frontera de día al crear: con UTC 13 y Madrid 14, 2026-10-13 → 400 y 2026-10-14 → 201', async () => {
    clock.set('2026-10-13T22:30:00Z');

    const yesterday = await post({ title: TITLE, enrollmentDeadline: '2026-10-13' });
    expectDeadlineError(yesterday, PAST_DATE, '2026-10-13');
    expect(countJobs()).toBe(0);

    const today = await post({ title: TITLE, enrollmentDeadline: '2026-10-14' });
    expect(today.statusCode).toBe(201);
    expect(today.json<Job>().enrollmentDeadline).toBe('2026-10-14');
  });
});
