import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JobPage, JobStatus } from '../../src/modules/jobs/schemas.ts';
import {
  closeJob,
  createJob,
  createTestApp,
  createTestClock,
  publishJob,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Los parámetros inválidos, la inyección y los logs van en list-filters-adversarial.test.ts.
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

async function listJobs(query = ''): Promise<JobPage> {
  const response = await app.inject({ method: 'GET', url: `/api/jobs${query}` });
  expect(response.statusCode).toBe(200);
  return response.json<JobPage>();
}

/** Crea una oferta completa en el estado pedido y avanza el reloj un minuto (fija el orden del listado). */
async function createJobWithStatus(title: string, status: JobStatus): Promise<number> {
  const job = await createJob(app, {
    title,
    description: 'Descripción inventada del puesto.',
    location: 'Valencia',
    workMode: 'remota',
  });
  clock.advance(MINUTE);
  if (status !== 'draft') {
    await publishJob(app, job.id);
    clock.advance(MINUTE);
  }
  if (status === 'closed') {
    await closeJob(app, job.id);
    clock.advance(MINUTE);
  }
  return job.id;
}

/** Crea `count` borradores con `createdAt` escalonado un minuto (el último, el más reciente). */
async function createDrafts(count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let n = 1; n <= count; n += 1) {
    ids.push(await createJobWithStatus(`Oferta de prueba ${n}`, 'draft'));
  }
  return ids;
}

const titlesOf = (page: JobPage): string[] => page.items.map((item) => item.title);

describe('GET /api/jobs — filtros', () => {
  it('CA-16 published + gestion → 2 en orden, total 2', async () => {
    await createJobWithStatus('Responsable de gestión de nóminas', 'published');
    await createJobWithStatus('Técnico/a de gestión administrativa', 'draft');
    await createJobWithStatus('GESTIÓN de proveedores', 'published');
    await createJobWithStatus('Analista de datos junior', 'published');
    await createJobWithStatus('Gestión de flotas', 'closed');

    const page = await listJobs('?status=published&q=gestion');

    expect(titlesOf(page)).toEqual(['GESTIÓN de proveedores', 'Responsable de gestión de nóminas']);
    expect(page.items.every((item) => item.status === 'published')).toBe(true);
    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 20 });
  });

  it('RF-05 status solo filtra por estado y el total es el del resultado filtrado', async () => {
    await createJobWithStatus('Operario/a de planta', 'draft');
    await createJobWithStatus('Soldador/a', 'closed');
    await createJobWithStatus('Peón/a de obra', 'closed');

    const closed = await listJobs('?status=closed');
    const everything = await listJobs();

    expect(titlesOf(closed)).toEqual(['Peón/a de obra', 'Soldador/a']);
    expect(closed.total).toBe(2);
    expect(everything.total).toBe(3);
  });
});

describe('GET /api/jobs — paginación', () => {
  it('CA-17/EC-34 25 ofertas: page 2 → 5 en orden, pageSize 100 → 25, page 3 → vacía con total 25', async () => {
    const ids = await createDrafts(25);
    const newestFirst = [...ids].reverse();

    const second = await listJobs('?page=2');
    const all = await listJobs('?pageSize=100');
    const beyond = await listJobs('?page=3');

    expect(second.items.map((item) => item.id)).toEqual(newestFirst.slice(20));
    expect(second).toMatchObject({ total: 25, page: 2, pageSize: 20 });
    expect(all.items.map((item) => item.id)).toEqual(newestFirst);
    expect(all).toMatchObject({ total: 25, page: 1, pageSize: 100 });
    expect(beyond).toMatchObject({ items: [], total: 25, page: 3, pageSize: 20 });
  });

  it.each([
    [20, 0],
    [21, 1],
  ])('CA-17/EC-34 %i ofertas → la página 2 trae %i', async (count, onSecondPage) => {
    await createDrafts(count);

    const second = await listJobs('?page=2');

    expect(second.items).toHaveLength(onSecondPage);
    expect(second.total).toBe(count);
  });

  it('CA-17/EC-34 pageSize 1 y 100 son válidos', async () => {
    const ids = await createDrafts(3);

    const one = await listJobs('?pageSize=1&page=2');
    const hundred = await listJobs('?pageSize=100');

    expect(one.items.map((item) => item.id)).toEqual([ids[1]]);
    expect(one).toMatchObject({ total: 3, page: 2, pageSize: 1 });
    expect(hundred.items).toHaveLength(3);
  });

  it('EC-37 publicar entre la página 1 y la 2 desplaza el orden (aceptado, DEC-10)', async () => {
    const ids = await createDrafts(25);
    const first = await listJobs();
    expect(first.items.at(-1)?.id).toBe(ids[5]);

    await publishJob(app, ids[0] as number); // la más antigua pasa a la cabeza
    const second = await listJobs('?page=2');

    // La última de la página 1 ya vista (ids[5]) vuelve a salir al principio de la 2: el orden se ha desplazado.
    expect(second.items.map((item) => item.id)).toEqual([ids[5], ids[4], ids[3], ids[2], ids[1]]);
    expect(second.total).toBe(25);
  });
});

describe('GET /api/jobs — búsqueda', () => {
  it('EC-35 sin mayúsculas ni tildes: gestion y GESTIÓN encuentran «gestión»; ano encuentra «año»', async () => {
    await createJobWithStatus('Responsable de gestión de nóminas', 'published');
    await createJobWithStatus('Becario/a de año en prácticas', 'published');
    await createJobWithStatus('Analista de datos junior', 'published');

    const lower = await listJobs('?q=gestion');
    const upper = await listJobs(`?q=${encodeURIComponent('GESTIÓN')}`);
    const year = await listJobs('?q=ano');

    expect(titlesOf(lower)).toEqual(['Responsable de gestión de nóminas']);
    expect(titlesOf(upper)).toEqual(['Responsable de gestión de nóminas']);
    expect(titlesOf(year)).toEqual(['Becario/a de año en prácticas']);
    expect(year.total).toBe(1);
  });

  it.each(['?q=', `?q=${encodeURIComponent('   ')}`])(
    'EC-35 q vacío o de espacios (%s) = sin filtro',
    async (query) => {
      await createDrafts(3);

      const page = await listJobs(query);

      expect(page.total).toBe(3);
      expect(page.items).toHaveLength(3);
    },
  );

  it('EC-35 q se recorta y busca como texto literal (% no es comodín)', async () => {
    await createJobWithStatus('Responsable de gestión', 'draft');
    await createJobWithStatus('Descuento del 50% en formación', 'draft');

    const trimmed = await listJobs(`?q=${encodeURIComponent('  gestion  ')}`);
    const percent = await listJobs(`?q=${encodeURIComponent('%')}`);

    expect(titlesOf(trimmed)).toEqual(['Responsable de gestión']);
    expect(titlesOf(percent)).toEqual(['Descuento del 50% en formación']);
  });

  it('EC-38 un título guardado en NFD lo encuentran «gestion» y «gestión»', async () => {
    const nfdTitle = 'Gestión de proveedores'.normalize('NFD');
    expect(nfdTitle).not.toBe('Gestión de proveedores');
    await createJobWithStatus(nfdTitle, 'draft');

    const plain = await listJobs('?q=gestion');
    const accented = await listJobs(`?q=${encodeURIComponent('gestión')}`);

    expect(titlesOf(plain)).toEqual([nfdTitle]);
    expect(titlesOf(accented)).toEqual([nfdTitle]);
  });

  it('EC-48 q=Pena encuentra «peña» y «penalizaciones» (consecuencia aceptada de DT-05)', async () => {
    await createJobWithStatus('Monitor/a de la peña deportiva', 'draft');
    await createJobWithStatus('Técnico/a de penalizaciones aduaneras', 'draft');
    await createJobWithStatus('Analista de datos junior', 'draft');

    const page = await listJobs('?q=Pena');

    expect(titlesOf(page)).toEqual([
      'Técnico/a de penalizaciones aduaneras',
      'Monitor/a de la peña deportiva',
    ]);
    expect(page.total).toBe(2);
  });
});
