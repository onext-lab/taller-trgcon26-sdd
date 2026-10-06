import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CandidatePage } from '../../src/modules/candidates/schemas.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createTestApp, createTestClock, type TestClock } from '../helpers/test-app.ts';

// Datos inventados. Los parámetros inválidos, la inyección y los logs van en TASK-08.
const NOW = '2026-10-06T08:00:00.000Z';
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

async function listCandidates(query = ''): Promise<CandidatePage> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates${query}` });
  expect(response.statusCode).toBe(200);
  return response.json<CandidatePage>();
}

/** Crea un candidato y avanza el reloj un minuto (fija el orden del listado: el último, el más reciente). */
async function addCandidate(fullName: string, email: string, skills: string[] = []) {
  const created = await createCandidate(app, { fullName, email, skills });
  clock.advance(MINUTE);
  return created;
}

/** Crea `count` candidatos `Candidato n` con `createdAt` escalonado un minuto. */
async function addMany(count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let n = 1; n <= count; n += 1) {
    ids.push((await addCandidate(`Candidato ${n}`, `candidato${n}@example.com`)).id);
  }
  return ids;
}

const namesOf = (page: CandidatePage): string[] => page.items.map((item) => item.fullName);

describe('GET /api/candidates — búsqueda y forma (CA-15, CA-17, CA-18, RNF-04)', () => {
  it('CA-15 «José Ruiz» sale con q=jose y con q=ruiz@exa, con exactamente 4 campos', async () => {
    const jose = await addCandidate('José Ruiz', 'jose.ruiz@example.com', ['sql']);
    await addCandidate('Ana Gil', 'ana.gil@example.com');

    for (const query of ['?q=jose', '?q=ruiz@exa']) {
      const page = await listCandidates(query);
      expect(page.items).toEqual([
        { id: jose.id, fullName: 'José Ruiz', email: 'jose.ruiz@example.com', skills: ['sql'] },
      ]);
      expect(Object.keys(page.items[0]!).sort()).toEqual(['email', 'fullName', 'id', 'skills']);
      expect(page).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    }
  });

  it('CA-17 q=jose&skill=SQL con José Ruiz (sql) y José Martín (sin ella) → solo José Ruiz', async () => {
    await addCandidate('José Ruiz', 'jose.ruiz@example.com', ['typescript', 'sql']);
    await addCandidate('José Martín', 'jose.martin@example.com', ['react']);

    const page = await listCandidates('?q=jose&skill=SQL');

    expect(namesOf(page)).toEqual(['José Ruiz']);
    expect(page.total).toBe(1);
  });

  it('CA-17 la skill es exacta, no parcial', async () => {
    await addCandidate('Ana Gil', 'ana.gil@example.com', ['typescript']);

    expect((await listCandidates('?skill=type')).items).toEqual([]);
    expect(namesOf(await listCandidates('?skill=typescript'))).toEqual(['Ana Gil']);
  });

  it('CA-18 sin coincidencias → items [] y total 0', async () => {
    await addCandidate('Ana Gil', 'ana.gil@example.com');

    const page = await listCandidates('?q=zzz');

    expect(page).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('RNF-04 el listado no filtra teléfono, resumen ni consentimiento', async () => {
    await createCandidate(app, {
      fullName: 'Marta Olmedo',
      email: 'marta.olmedo@example.com',
      phone: '600 000 022',
      summary: 'Resumen inventado.',
      consent: true,
    });

    const response = await app.inject({ method: 'GET', url: '/api/candidates' });

    expect(response.body).not.toMatch(/phone|summary|consent|retention|createdAt|600 000 022/);
  });
});

describe('GET /api/candidates — paginación (CA-16, CA-19, EC-28)', () => {
  it('CA-16 con 25 y sin filtros → los 20 más recientes, total 25, page 1, pageSize 20', async () => {
    const ids = await addMany(25);

    const page = await listCandidates();

    expect(page.items.map((item) => item.id)).toEqual(ids.slice(5).reverse());
    expect(page).toMatchObject({ total: 25, page: 1, pageSize: 20 });
  });

  it('CA-19 page=2 → los 5 restantes; pageSize=100 → los 25; page=3 → items [] con total 25', async () => {
    const ids = await addMany(25);

    const second = await listCandidates('?page=2');
    const all = await listCandidates('?pageSize=100');
    const third = await listCandidates('?page=3');

    expect(second.items.map((item) => item.id)).toEqual(ids.slice(0, 5).reverse());
    expect(second).toMatchObject({ total: 25, page: 2, pageSize: 20 });
    expect(all.items).toHaveLength(25);
    expect(all).toMatchObject({ total: 25, page: 1, pageSize: 100 });
    expect(third).toEqual({ items: [], total: 25, page: 3, pageSize: 20 });
  });

  it.each([
    [0, 0, 0],
    [20, 20, 20],
    [21, 20, 21],
  ])(
    'EC-28 con %i candidatos → %i en la primera página y total %i',
    async (count, shown, total) => {
      await addMany(count);

      const page = await listCandidates();

      expect(page.items).toHaveLength(shown);
      expect(page.total).toBe(total);
    },
  );

  it('EC-28 q de 100 caracteres → 200; de 101 → 400', async () => {
    await addMany(1);

    expect((await listCandidates(`?q=${'a'.repeat(100)}`)).total).toBe(0);
    const tooLong = await app.inject({
      method: 'GET',
      url: `/api/candidates?q=${'a'.repeat(101)}`,
    });
    expect(tooLong.statusCode).toBe(400);
  });

  it('EC-28 q o skill solo con espacios → sin filtro', async () => {
    await addCandidate('Ana Gil', 'ana.gil@example.com', ['sql']);
    await addCandidate('Luis Mora', 'luis.mora@example.com');

    expect((await listCandidates('?q=%20%20%20')).total).toBe(2);
    expect((await listCandidates('?skill=%20%20')).total).toBe(2);
    expect((await listCandidates('?q=&skill=')).total).toBe(2);
    expect((await listCandidates('?q=%20ana%20')).total).toBe(1);
  });
});

describe('GET /api/candidates — orden y plegado (EC-29)', () => {
  it('EC-29 «José Ruiz» y «JOSÉ MARTÍN» salen con q=jose, el más reciente primero', async () => {
    await addCandidate('José Ruiz', 'jose.ruiz@example.com');
    await addCandidate('JOSÉ MARTÍN', 'jose.martin@example.com');

    expect(namesOf(await listCandidates('?q=jose'))).toEqual(['JOSÉ MARTÍN', 'José Ruiz']);
    expect(namesOf(await listCandidates('?q=JOSÉ'))).toEqual(['JOSÉ MARTÍN', 'José Ruiz']);
  });

  it('EC-29 con el mismo createdAt, primero el ID mayor', async () => {
    const first = await createCandidate(app, { fullName: 'Ana Uno', email: 'ana.uno@example.com' });
    const second = await createCandidate(app, {
      fullName: 'Ana Dos',
      email: 'ana.dos@example.com',
    });
    expect(second.createdAt).toBe(first.createdAt);

    const page = await listCandidates();

    expect(page.items.map((item) => item.id)).toEqual([second.id, first.id]);
  });

  it('EC-29 «%» y «_» son literales, no comodines', async () => {
    await addCandidate('Ana Gil', 'ana.gil@example.com');

    expect((await listCandidates('?q=%25')).total).toBe(0);
    expect((await listCandidates('?q=a_a')).total).toBe(0);
  });
});
