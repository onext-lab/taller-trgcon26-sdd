import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorDetail } from '../../src/errors.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import {
  createPublishedJob,
  createTestApp,
  createTestClock,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Reloj en 2026-10-13 (Madrid); «hoy» sale siempre del reloj inyectado (DEC-09).
const TITLE = 'Analista de datos junior';
const INVALID_DATE = 'Introduce una fecha válida.';
const PAST_DATE = 'La fecha límite no puede ser anterior a hoy.';
const SALARY_MESSAGE = 'El salario mínimo no puede ser mayor que el máximo.';

let app: FastifyInstance;
let clock: TestClock;

beforeEach(() => {
  clock = createTestClock('2026-10-13T10:00:00Z');
  ({ app } = createTestApp({ now: clock.now }));
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

async function countJobs(): Promise<number> {
  const response = await app.inject({ method: 'GET', url: '/api/jobs' });
  return response.json<{ total: number }>().total;
}

function detailsOf(response: LightMyRequestResponse): ErrorDetail[] {
  return response.json<{ error: { details: ErrorDetail[] } }>().error.details;
}

/** 400 `VALIDATION_ERROR` con un único detalle en `enrollmentDeadline`, sin repetir el valor recibido (DEC-11.4). */
function expectDeadlineError(response: LightMyRequestResponse, message: string, value: string) {
  expect(response.statusCode).toBe(400);
  expect(response.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
  expect(detailsOf(response)).toEqual([{ field: 'enrollmentDeadline', message }]);
  expect(response.body).not.toContain(value);
}

describe('fecha límite — alta y detalle', () => {
  it('CA-01 alta con 2026-10-13, con 2036-10-13 y sin fecha → 201 draft con la fecha o null', async () => {
    const cases: [Record<string, unknown>, string | null][] = [
      [{ title: TITLE, enrollmentDeadline: '2026-10-13' }, '2026-10-13'],
      [{ title: TITLE, enrollmentDeadline: '2036-10-13' }, '2036-10-13'],
      [{ title: TITLE }, null],
    ];
    for (const [payload, expected] of cases) {
      const response = await post(payload);

      expect(response.statusCode).toBe(201);
      const created = response.json<Job>();
      expect(created).toMatchObject({ status: 'draft', enrollmentDeadline: expected });
      expect((await getJob(created.id)).enrollmentDeadline).toBe(expected);
    }
  });

  it('CA-01 alta con enrollmentDeadline null explícito → 201 con null', async () => {
    const response = await post({ title: TITLE, enrollmentDeadline: null });

    expect(response.statusCode).toBe(201);
    expect(response.json<Job>().enrollmentDeadline).toBeNull();
  });

  it('CA-01 y EC-02: 2028-02-29 → 201; 2027-02-29 → 400 «Introduce una fecha válida.»', async () => {
    const leap = await post({ title: TITLE, enrollmentDeadline: '2028-02-29' });
    const common = await post({ title: TITLE, enrollmentDeadline: '2027-02-29' });

    expect(leap.statusCode).toBe(201);
    expect(leap.json<Job>().enrollmentDeadline).toBe('2028-02-29');
    expectDeadlineError(common, INVALID_DATE, '2027-02-29');
  });

  it('CA-01 «hoy» es el día de Madrid: a las 22:30 UTC del 13 ya es 14', async () => {
    clock.set('2026-10-13T22:30:00Z');

    const yesterday = await post({ title: TITLE, enrollmentDeadline: '2026-10-13' });
    const today = await post({ title: TITLE, enrollmentDeadline: '2026-10-14' });

    expectDeadlineError(yesterday, PAST_DATE, '2026-10-13');
    expect(today.statusCode).toBe(201);
  });
});

describe('fecha límite — validación del día en el alta', () => {
  it('CA-02 alta con 2026-10-12 → 400 «anterior a hoy»; con 2026-02-31 → 400 «fecha válida»; 0 ofertas', async () => {
    const past = await post({ title: TITLE, enrollmentDeadline: '2026-10-12' });
    const impossible = await post({ title: TITLE, enrollmentDeadline: '2026-02-31' });

    expectDeadlineError(past, PAST_DATE, '2026-10-12');
    expectDeadlineError(impossible, INVALID_DATE, '2026-02-31');
    expect(await countJobs()).toBe(0);
  });

  it('EC-02 valores que no son AAAA-MM-DD → 400 «Introduce una fecha válida.»; 0 ofertas', async () => {
    for (const value of ['2026-13-01', '13/10/2026', '2026-10-13T00:00:00Z', '<script>']) {
      const response = await post({ title: TITLE, enrollmentDeadline: value });

      expectDeadlineError(response, INVALID_DATE, value);
    }
    expect(await countJobs()).toBe(0);
  });

  it('CA-02 banda inválida y fecha pasada → un único 400 con los dos details', async () => {
    const response = await post({
      title: TITLE,
      salaryMin: 50000,
      salaryMax: 40000,
      enrollmentDeadline: '2026-10-12',
    });

    expect(response.statusCode).toBe(400);
    expect(detailsOf(response)).toEqual([
      { field: 'salaryMin', message: SALARY_MESSAGE },
      { field: 'enrollmentDeadline', message: PAST_DATE },
    ]);
    expect(await countJobs()).toBe(0);
  });
});

describe('fecha límite — edición', () => {
  it('CA-03 published 2026-10-20 → 15/10, 30/11 y null: 200, mismo estado y fechas', async () => {
    const published = await createPublishedJob(app, { enrollmentDeadline: '2026-10-20' });
    expect(published.enrollmentDeadline).toBe('2026-10-20');

    for (const next of ['2026-10-15', '2026-11-30', null]) {
      const response = await patch(published.id, { enrollmentDeadline: next });

      expect(response.statusCode).toBe(200);
      const updated = response.json<Job>();
      expect(updated.enrollmentDeadline).toBe(next);
      expect(updated).toMatchObject({
        status: 'published',
        createdAt: published.createdAt,
        publishedAt: published.publishedAt,
        closedAt: published.closedAt,
      });
      expect(await getJob(published.id)).toEqual(updated);
    }
  });

  it('CA-03 un PATCH de otro campo no toca la fecha límite', async () => {
    const created = (await post({ title: TITLE, enrollmentDeadline: '2026-10-20' })).json<Job>();

    const response = await patch(created.id, { title: 'Analista de datos senior' });

    expect(response.statusCode).toBe(200);
    expect(response.json<Job>()).toMatchObject({
      title: 'Analista de datos senior',
      enrollmentDeadline: '2026-10-20',
    });
  });

  it('EC-03 "" y espacios → null en alta y edición', async () => {
    for (const blank of ['', '   ']) {
      const created = await post({ title: TITLE, enrollmentDeadline: blank });
      expect(created.statusCode).toBe(201);
      expect(created.json<Job>().enrollmentDeadline).toBeNull();
    }
    const withDeadline = (
      await post({ title: TITLE, enrollmentDeadline: '2026-10-20' })
    ).json<Job>();

    for (const blank of ['', '   ']) {
      await patch(withDeadline.id, { enrollmentDeadline: '2026-10-20' });
      const response = await patch(withDeadline.id, { enrollmentDeadline: blank });

      expect(response.statusCode).toBe(200);
      expect(response.json<Job>().enrollmentDeadline).toBeNull();
    }
  });

  it('EC-05 dos ediciones seguidas: gana la última', async () => {
    const created = (await post({ title: TITLE })).json<Job>();

    const first = await patch(created.id, { enrollmentDeadline: '2026-10-20' });
    const second = await patch(created.id, { enrollmentDeadline: '2026-11-05' });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect((await getJob(created.id)).enrollmentDeadline).toBe('2026-11-05');
  });
});

describe('fecha límite — validación del día en la edición', () => {
  it('CA-04 y EC-17 draft: 2026-10-12 y 2026-13-01 → 400 junto al campo; la oferta igual', async () => {
    const draft = (await post({ title: TITLE, enrollmentDeadline: '2026-10-20' })).json<Job>();

    const past = await patch(draft.id, { enrollmentDeadline: '2026-10-12' });
    const invalid = await patch(draft.id, { enrollmentDeadline: '2026-13-01' });

    expectDeadlineError(past, PAST_DATE, '2026-10-12');
    expectDeadlineError(invalid, INVALID_DATE, '2026-13-01');
    expect(detailsOf(past)[0]?.field).toBe('enrollmentDeadline');
    expect(await getJob(draft.id)).toEqual(draft);
  });

  it('CA-04 la fecha va detrás de los obligatorios y la banda, en el mismo 400', async () => {
    const published = await createPublishedJob(app, { enrollmentDeadline: '2026-10-20' });

    const response = await patch(published.id, {
      description: '',
      salaryMin: 50000,
      salaryMax: 40000,
      enrollmentDeadline: '2026-10-12',
    });

    expect(response.statusCode).toBe(400);
    expect(detailsOf(response).map((d) => d.field)).toEqual([
      'description',
      'salaryMin',
      'enrollmentDeadline',
    ]);
    expect(await getJob(published.id)).toEqual(published);
  });

  it('CA-05 y EC-08 published vencida: editar la descripción y reenviar 2026-10-10 → 200', async () => {
    clock.set('2026-10-01T10:00:00Z');
    const published = await createPublishedJob(app, { enrollmentDeadline: '2026-10-10' });
    clock.set('2026-10-13T10:00:00Z');

    const response = await patch(published.id, {
      description: 'Descripción inventada, revisada.',
      enrollmentDeadline: '2026-10-10',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<Job>()).toMatchObject({
      status: 'published',
      description: 'Descripción inventada, revisada.',
      enrollmentDeadline: '2026-10-10',
    });
  });

  it('EC-23 published vencida: otro campo → 200; otra fecha pasada → 400; quitar el plazo → 200', async () => {
    clock.set('2026-10-01T10:00:00Z');
    const published = await createPublishedJob(app, { enrollmentDeadline: '2026-10-10' });
    clock.set('2026-10-13T10:00:00Z');

    const other = await patch(published.id, { location: 'Sevilla' });
    const earlier = await patch(published.id, { enrollmentDeadline: '2026-10-09' });
    const cleared = await patch(published.id, { enrollmentDeadline: null });

    expect(other.statusCode).toBe(200);
    expect(other.json<Job>().enrollmentDeadline).toBe('2026-10-10');
    expectDeadlineError(earlier, PAST_DATE, '2026-10-09');
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json<Job>().enrollmentDeadline).toBeNull();
  });
});
