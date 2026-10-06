import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCandidate } from '../helpers/candidates.ts';
import { createTestApp, createTestClock, failWrites } from '../helpers/test-app.ts';

// TASK-07 [adversarial]: concurrencia, fallo de la base y enumeración en PATCH /api/candidates/:id. Datos inventados.
const NOW = '2026-10-06T09:00:00.000Z';
const GENERIC_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

function patch(id: number | string, payload: unknown) {
  return app.inject({ method: 'PATCH', url: `/api/candidates/${id}`, payload: payload as object });
}

async function getJson(id: number) {
  return (await app.inject({ method: 'GET', url: `/api/candidates/${id}` })).json();
}

function seed(overrides: Record<string, unknown> = {}) {
  return createCandidate(app, {
    fullName: 'Lucía Ferrer Soler',
    email: 'lucia.ferrer@example.com',
    phone: '600 000 001',
    summary: 'Resumen inventado inicial.',
    skills: ['typescript'],
    ...overrides,
  });
}

describe('PATCH /api/candidates/:id — concurrencia (EC-22)', () => {
  it('EC-22 dos PATCH seguidos a la misma ficha → gana el último y el GET final lo refleja', async () => {
    const created = await seed();
    const first = { fullName: 'Primera Versión', summary: 'Resumen de la pestaña A.' };
    const second = { fullName: 'Segunda Versión', summary: 'Resumen de la pestaña B.' };

    expect((await patch(created.id, first)).statusCode).toBe(200);
    expect((await patch(created.id, second)).statusCode).toBe(200);

    expect(await getJson(created.id)).toMatchObject(second);
  });

  it('EC-22 dos PATCH a la vez a la misma ficha → dos 200 y la ficha final es entera de uno de los dos', async () => {
    const created = await seed();
    const bodies = [
      { fullName: 'Pestaña Alfa', phone: '611 111 111', skills: ['sql'] },
      { fullName: 'Pestaña Beta', phone: '622 222 222', skills: ['python'] },
    ];

    const responses = await Promise.all(bodies.map((body) => patch(created.id, body)));

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    const final = await getJson(created.id);
    const winner = bodies.find((body) => body.fullName === final.fullName);
    expect(winner).toBeDefined();
    expect(final).toMatchObject(winner as object);
  });

  it('EC-22 dos candidatos pasan a la vez al mismo email libre → un 200, un 409 con el ID del primero y una fila', async () => {
    const one = await seed({ email: 'uno@example.com' });
    const two = await seed({ email: 'dos@example.com' });
    const target = { email: 'libre@example.com' };

    const responses = await Promise.all([patch(one.id, target), patch(two.id, target)]);

    const winnerIndex = responses.findIndex((response) => response.statusCode === 200);
    const loserIndex = winnerIndex === 0 ? 1 : 0;
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const winnerId = [one.id, two.id][winnerIndex];
    expect(responses[loserIndex]?.json()).toEqual({
      error: {
        code: 'DUPLICATE',
        message: expect.any(String),
        details: [
          {
            field: 'email',
            message: 'Ya existe un candidato con este email.',
            existingId: winnerId,
          },
        ],
      },
    });
    const rows = db
      .prepare('SELECT COUNT(*) AS total FROM candidates WHERE email = ?')
      .get(target.email);
    expect(Number(rows?.total)).toBe(1);
    const loserId = [one.id, two.id][loserIndex] as number;
    expect((await getJson(loserId)).email).toBe(
      loserId === one.id ? 'uno@example.com' : 'dos@example.com',
    );
  });
});

describe('PATCH /api/candidates/:id — fallo de la base (CA-14, EC-23)', () => {
  it('CA-14/EC-23 fallo del UPDATE → 500 genérico sin datos personales y la ficha queda como estaba', async () => {
    const created = await seed();
    const before = await getJson(created.id);
    failWrites(db, 'UPDATE', { table: 'candidates' });

    const response = await patch(created.id, {
      fullName: 'Nombre Nuevo Hostil',
      email: 'nuevo.hostil@example.com',
      phone: '699 999 999',
      summary: 'Resumen nuevo hostil.',
      skills: ['rust'],
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(GENERIC_ERROR);
    for (const text of [
      'Nombre Nuevo',
      'nuevo.hostil',
      '699',
      'Resumen nuevo',
      'rust',
      'SQLITE',
      'stack',
    ]) {
      expect(response.body).not.toContain(text);
    }
    expect(await getJson(created.id)).toEqual(before);
  });
});

describe('PATCH /api/candidates/:id — enumeración y fugas (EC-25)', () => {
  it('EC-25 IDs secuenciales inexistentes → 404 NOT_FOUND con el mismo cuerpo, sin datos', async () => {
    const created = await seed();
    const ids = [created.id + 1, created.id + 2, created.id + 3, 9999];

    const responses = await Promise.all(
      ids.map((id) => patch(id, { fullName: 'Nombre Inventado' })),
    );

    expect(responses.map((response) => response.statusCode)).toEqual([404, 404, 404, 404]);
    const [reference] = responses;
    for (const response of responses) {
      expect(response.body).toBe(reference?.body);
    }
    expect(reference?.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'El candidato no existe.' },
    });
  });

  it('EC-25 el 409 de email no contiene el email ni datos del existente', async () => {
    await seed();
    const other = await seed({
      fullName: 'Otro Candidato',
      email: 'otro@example.com',
      phone: null,
    });

    const response = await patch(other.id, { email: 'Lucia.Ferrer@Example.com' });

    expect(response.statusCode).toBe(409);
    for (const text of [
      'lucia',
      'Lucía',
      'Ferrer',
      'example.com',
      '600',
      'Resumen',
      'typescript',
    ]) {
      expect(response.body).not.toContain(text);
    }
  });
});
