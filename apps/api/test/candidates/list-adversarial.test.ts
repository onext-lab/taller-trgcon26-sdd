import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CandidatePage } from '../../src/modules/candidates/schemas.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';

// TASK-08 [adversarial]: parámetros hostiles en GET /api/candidates. Datos inventados. Los caminos felices están en
// list.test.ts y los logs en privacy-logs.test.ts.
const NOW = '2026-10-06T08:00:00.000Z';
const INVALID_FORMAT = 'Formato no válido.';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

function list(query: string) {
  return app.inject({ method: 'GET', url: `/api/candidates${query}` });
}

async function listPage(query: string): Promise<CandidatePage> {
  const response = await list(query);
  expect(response.statusCode).toBe(200);
  return response.json<CandidatePage>();
}

const countCandidates = (): number =>
  Number(db.prepare('SELECT COUNT(*) AS n FROM candidates').get()?.n);

/** 400 con `details` exactamente `[{ field, message }]` y sin ninguno de los textos enviados en el cuerpo. */
function expectRejected(
  response: LightMyRequestResponse,
  field: string,
  message: string,
  leaked: string[] = [],
): void {
  expect(response.statusCode).toBe(400);
  const { error } = response.json<{ error: { code: string; details: unknown } }>();
  expect(error.code).toBe('VALIDATION_ERROR');
  expect(error.details).toEqual([{ field, message }]);
  for (const text of leaked) expect(response.body).not.toContain(text);
}

describe('GET /api/candidates — parámetros inválidos (CA-20, EC-27)', () => {
  it('CA-20/EC-27 q de 101 caracteres → 400 en q sin repetir su texto', async () => {
    const q = `${'x'.repeat(95)}SECRETQ`;

    const response = await list(`?q=${encodeURIComponent(q)}`);

    expectRejected(response, 'q', 'Debe tener como máximo 100 caracteres.', ['SECRETQ', 'xxxxx']);
  });

  it('CA-20/EC-27 q con \\u0000 dentro → 400 en q sin repetir su texto', async () => {
    const response = await list('?q=ana%00SECRETQ');

    expectRejected(response, 'q', INVALID_FORMAT, ['SECRETQ', 'ana']);
  });

  it.each([
    ['page=0', 'page'],
    ['page=abc', 'page'],
    ['page=-1', 'page'],
    ['pageSize=0', 'pageSize'],
    ['pageSize=101', 'pageSize'],
    ['pageSize=abc', 'pageSize'],
  ])('CA-20/EC-27 %s → 400 en su parámetro', async (query, field) => {
    expectRejected(await list(`?${query}`), field, INVALID_FORMAT);
  });

  it.each(['sort=fullName', 'lucia.ferrer%40example.com=1', 'q=ana&secretparam=1'])(
    'CA-20/EC-27 parámetro desconocido (%s) → «Hay campos no permitidos.» sin su nombre',
    async (query) => {
      const response = await list(`?${query}`);

      expectRejected(response, 'querystring', 'Hay campos no permitidos.', [
        'sort',
        'secretparam',
        'lucia',
      ]);
    },
  );
});

describe('GET /api/candidates — límites y texto hostil de q (CA-20, EC-33)', () => {
  it('CA-20 q de 100 caracteres → 200', async () => {
    const response = await list(`?q=${encodeURIComponent('a'.repeat(100))}`);

    expect(response.statusCode).toBe(200);
    expect(response.json<CandidatePage>()).toMatchObject({ items: [], total: 0 });
  });

  it("CA-20 q=' OR 1=1 -- → 200 con 0 resultados y sin tocar la tabla", async () => {
    await createCandidate(app, { fullName: 'Ana Gil', email: 'ana.gil@example.com' });
    await createCandidate(app, { fullName: 'Luis Mora', email: 'luis.mora@example.com' });

    const injection = await listPage(`?q=${encodeURIComponent("' OR 1=1 --")}`);
    const drop = await listPage(`?q=${encodeURIComponent("'; DROP TABLE candidates; --")}`);

    expect(injection).toMatchObject({ items: [], total: 0 });
    expect(drop).toMatchObject({ items: [], total: 0 });
    expect(countCandidates()).toBe(2);
  });

  it('EC-33 q=% y q=_ son literales y cada item trae solo 4 claves', async () => {
    await createCandidate(app, { fullName: 'Ana Gil', email: 'ana.gil@example.com' });
    await createCandidate(app, { fullName: 'Descuento 50% Mora', email: 'mora@example.com' });
    await createCandidate(app, { fullName: 'Luis Soler', email: 'luis_soler@example.com' });

    const percent = await listPage(`?q=${encodeURIComponent('%')}`);
    const underscore = await listPage(`?q=${encodeURIComponent('_')}`);

    expect(percent.items.map((item) => item.fullName)).toEqual(['Descuento 50% Mora']);
    expect(underscore.items.map((item) => item.email)).toEqual(['luis_soler@example.com']);
    expect(percent.total).toBe(1);
    expect(underscore.total).toBe(1);
    for (const item of [...percent.items, ...underscore.items]) {
      expect(Object.keys(item).sort()).toEqual(['email', 'fullName', 'id', 'skills']);
    }
  });
});
