import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JobPage } from '../../src/modules/jobs/schemas.ts';
import { createJob, createTestApp, createTestClock, type TestClock } from '../helpers/test-app.ts';

// Datos inventados. Los casos hostiles del listado (parámetros, HTML, campos de más) van en TASK-07.
const NOW = '2026-10-06T22:30:00.000Z';
const MINUTE = 60_000;

let app: FastifyInstance;
let clock: TestClock;

beforeEach(() => {
  clock = createTestClock(NOW);
  ({ app } = createTestApp({ now: clock.now }));
});

afterEach(async () => {
  await app.close();
});

async function listJobs(): Promise<JobPage> {
  const response = await app.inject({ method: 'GET', url: '/api/jobs' });
  expect(response.statusCode).toBe(200);
  return response.json<JobPage>();
}

/** Crea `count` borradores con `createdAt` escalonado un minuto (el último, el más reciente). */
async function createDrafts(count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let n = 1; n <= count; n += 1) {
    const job = await createJob(app, { title: `Oferta de prueba ${n}` });
    ids.push(job.id);
    clock.advance(MINUTE);
  }
  return ids;
}

describe('GET /api/jobs — listado (camino feliz y fronteras)', () => {
  it('CA-15 25 borradores → 20 más recientes, total 25, page 1, pageSize 20', async () => {
    const ids = await createDrafts(25);

    const page = await listJobs();

    expect(page.total).toBe(25);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(20);
    expect(page.items.map((item) => item.id)).toEqual(ids.slice(5).reverse());
    expect(page.items[0]).toEqual({
      id: ids[24],
      title: 'Oferta de prueba 25',
      status: 'draft',
      referenceDate: '2026-10-06T22:54:00.000Z',
    });
    const dates = page.items.map((item) => item.referenceDate);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('CA-16/EC-36 devuelve el instante UTC del reloj', async () => {
    await createJob(app, { title: 'Recepcionista de hotel' });

    const page = await listJobs();

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.referenceDate).toBe(NOW);
  });

  it.each([
    [0, 0],
    [20, 20],
    [21, 20],
  ])('CA-17/EC-35 %i ofertas → %i items', async (count, expectedItems) => {
    await createDrafts(count);

    const page = await listJobs();

    expect(page).toMatchObject({ total: count, page: 1, pageSize: 20 });
    expect(page.items).toHaveLength(expectedItems);
  });

  it('EC-37 misma fecha → ID mayor primero', async () => {
    const first = await createJob(app, { title: 'Mozo/a de almacén' });
    const second = await createJob(app, { title: 'Carretillero/a' });
    const third = await createJob(app, { title: 'Jefe/a de turno' });

    const page = await listJobs();

    expect(page.items.map((item) => item.id)).toEqual([third.id, second.id, first.id]);
    expect(new Set(page.items.map((item) => item.referenceDate))).toEqual(new Set([NOW]));
  });
});

describe('GET /api/jobs — adversarial', () => {
  it.each([
    ['?sort=title', 'sort'],
    ['?foo=1', 'foo'],
  ])('EC-34 (HU-01) parámetro desconocido %s → 400', async (query, field) => {
    await createDrafts(1);

    const response = await app.inject({ method: 'GET', url: `/api/jobs${query}` });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay campos con errores.',
        details: [{ field, message: 'Campo no permitido.' }],
      },
    });
  });

  it('EC-41 el título con HTML se devuelve literal', async () => {
    const title = '<img src=x onerror=alert(1)>';
    await createJob(app, { title });

    const page = await listJobs();

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.title).toBe(title);
  });

  it('RF-05 los items solo traen id, title, status y referenceDate', async () => {
    await createJob(app, {
      title: 'Oferta completa',
      description: 'Descripción inventada',
      location: 'Valencia',
      workMode: 'híbrida',
      salaryMin: 28000,
      salaryMax: 34000,
    });

    const page = await listJobs();

    expect(page.items).toHaveLength(1);
    for (const item of page.items) {
      expect(Object.keys(item).sort()).toEqual(['id', 'referenceDate', 'status', 'title']);
    }
  });
});
