import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '../../src/clock.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createTestApp, createTestClock, failWrites, type TestClock } from '../helpers/test-app.ts';

// Datos inventados. Madrid está en UTC+2 en estas fechas: 2026-10-06 + 24 meses = 2028-10-06.
const CREATED = '2026-02-06T09:00:00.000Z';
const GIVEN_EARLIER = '2026-03-01T09:00:00.000Z';
const NOW = '2026-10-06T09:00:00.000Z';

let app: FastifyInstance;
let db: DatabaseSync;
let clock: TestClock;
let nowCalls: number;

beforeEach(() => {
  nowCalls = 0;
  clock = createTestClock(CREATED);
  const counting: Clock = () => {
    nowCalls += 1;
    return clock.now();
  };
  ({ app, db } = createTestApp({ now: counting }));
});

afterEach(async () => {
  await app.close();
});

function give(id: number | string) {
  return app.inject({ method: 'POST', url: `/api/candidates/${id}/consent` });
}

function withdraw(id: number | string) {
  return app.inject({ method: 'POST', url: `/api/candidates/${id}/consent/withdrawal` });
}

function seed(overrides: Record<string, unknown> = {}) {
  return createCandidate(app, {
    fullName: 'Lucía Ferrer Soler',
    email: 'lucia.ferrer@example.com',
    ...overrides,
  });
}

describe('POST /api/candidates/:id/consent — registrar o renovar', () => {
  it('CA-25 registra la fecha del reloj, v1 y la retención + 24 meses', async () => {
    const created = await seed();
    clock.set(NOW);

    const response = await give(created.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...created,
      consentGivenAt: NOW,
      consentVersion: 'v1',
      consentWithdrawnAt: null,
      retentionEndsAt: '2028-10-06',
    });
  });

  it('CA-27 renovar un consentimiento vigente pone la fecha nueva, v1 y la retención nueva', async () => {
    const created = await seed();
    clock.set(GIVEN_EARLIER);
    await give(created.id);
    clock.set(NOW);

    const response = await give(created.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      consentGivenAt: NOW,
      consentVersion: 'v1',
      consentWithdrawnAt: null,
      retentionEndsAt: '2028-10-06',
    });
  });

  it('EC-44 reotorgar tras retirar da fecha y versión nuevas y borra la retirada', async () => {
    const created = await seed();
    clock.set(GIVEN_EARLIER);
    await give(created.id);
    clock.set('2026-06-01T09:00:00.000Z');
    await withdraw(created.id);
    clock.set(NOW);

    const response = await give(created.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      consentGivenAt: NOW,
      consentVersion: 'v1',
      consentWithdrawnAt: null,
      retentionEndsAt: '2028-10-06',
    });
  });

  it('EC-49 registrar dos veces: la segunda renueva con la fecha nueva', async () => {
    const created = await seed();
    clock.set(GIVEN_EARLIER);
    const first = await give(created.id);
    clock.set(NOW);

    const second = await give(created.id);

    expect(first.json().consentGivenAt).toBe(GIVEN_EARLIER);
    expect(second.json().consentGivenAt).toBe(NOW);
    expect(second.json().retentionEndsAt).toBe('2028-10-06');
  });

  it('un ID inexistente → 404 sin datos', async () => {
    const response = await give(999);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'El candidato no existe.' },
    });
  });
});

describe('POST /api/candidates/:id/consent/withdrawal — retirar', () => {
  it('CA-26 conserva otorgamiento y versión, pone la retirada y la retención sale del alta + 6 meses', async () => {
    const created = await seed();
    clock.set(GIVEN_EARLIER);
    await give(created.id);
    clock.set(NOW);

    const response = await withdraw(created.id);

    // EC-43: la fecha 2026-08-06 ya ha pasado y se guarda igualmente.
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...created,
      consentGivenAt: GIVEN_EARLIER,
      consentVersion: 'v1',
      consentWithdrawnAt: NOW,
      retentionEndsAt: '2026-08-06',
    });
  });

  it('CA-28 sin consentimiento vigente (nunca dado) devuelve la ficha idéntica sin leer el reloj ni escribir', async () => {
    const created = await seed();
    const before = (await app.inject({ method: 'GET', url: `/api/candidates/${created.id}` })).body;
    failWrites(db, 'UPDATE', { table: 'candidates' });
    nowCalls = 0;
    clock.set(NOW);

    const response = await withdraw(created.id);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(before);
    expect(nowCalls).toBe(0);
  });

  it('CA-28 sin consentimiento vigente (ya retirado) devuelve la ficha idéntica byte a byte', async () => {
    const created = await seed();
    clock.set(GIVEN_EARLIER);
    await give(created.id);
    clock.set('2026-06-01T09:00:00.000Z');
    const first = await withdraw(created.id);
    clock.set(NOW);
    failWrites(db, 'UPDATE', { table: 'candidates' });
    nowCalls = 0;

    const second = await withdraw(created.id);

    expect(second.statusCode).toBe(200);
    expect(second.body).toBe(first.body);
    expect(second.json().consentWithdrawnAt).toBe('2026-06-01T09:00:00.000Z');
    expect(nowCalls).toBe(0);
  });

  it('EC-49 retirar dos veces → 200 igual', async () => {
    const created = await seed({ consent: true });
    clock.set(NOW);

    const first = await withdraw(created.id);
    clock.set('2027-01-01T09:00:00.000Z');
    const second = await withdraw(created.id);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.body).toBe(first.body);
  });

  it('un ID inexistente → 404 sin datos', async () => {
    const response = await withdraw(999);

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});

describe('Retención con el puerto por defecto (sin inscripciones)', () => {
  it('CA-31 toda ficha tiene fecha de fin de retención, con y sin consentimiento', async () => {
    const without = await seed();
    const given = await seed({ email: 'otra.persona@example.com' });
    clock.set(NOW);
    const withdrawn = await give(given.id).then(() => withdraw(given.id));

    expect(without.retentionEndsAt).toBe('2026-08-06');
    expect(withdrawn.json().retentionEndsAt).toBe('2026-08-06');
    expect((await give(given.id)).json().retentionEndsAt).toBe('2028-10-06');
  });

  it('EC-57 dos recálculos seguidos dan la misma fecha', async () => {
    const created = await seed();
    clock.set(NOW);

    const first = await give(created.id);
    const second = await give(created.id);

    expect(first.json().retentionEndsAt).toBe('2028-10-06');
    expect(second.json().retentionEndsAt).toBe(first.json().retentionEndsAt);
    expect(second.body).toBe(first.body);
  });
});
