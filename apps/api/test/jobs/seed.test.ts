import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { SEED_TITLES_IN_LIST_ORDER, seed } from '../../src/db/seed.ts';
import { WORK_MODES, type Job, type JobPage } from '../../src/modules/jobs/schemas.ts';

let app: FastifyInstance;

beforeEach(() => {
  const db = openDatabase(':memory:');
  migrate(db);
  seed(db);
  app = buildApp({ db });
});

afterEach(async () => {
  await app.close();
});

const EXPECTED_TITLES = [
  'Desarrollador/a backend (Node.js)',
  'Desarrollador/a frontend (React)',
  'Diseñador/a de producto',
  'Administrativo/a contable',
  'Técnico/a de soporte IT',
  'Analista de datos junior',
  'Técnico/a de selección de personal',
  'Responsable de gestión de nóminas',
  'Becario/a de marketing digital',
  'Auxiliar de logística',
];

async function loadSeededJobs(): Promise<{ page: JobPage; jobs: Job[] }> {
  const list = await app.inject({ method: 'GET', url: '/api/jobs' });
  expect(list.statusCode).toBe(200);
  const page = list.json<JobPage>();
  const jobs: Job[] = [];
  for (const item of page.items) {
    const response = await app.inject({ method: 'GET', url: `/api/jobs/${item.id}` });
    expect(response.statusCode).toBe(200);
    jobs.push(response.json<Job>());
  }
  return { page, jobs };
}

describe('seed — datos de ejemplo (RF-07, CA-24)', () => {
  it('CA-24 migrate + seed → 10 ofertas (4 draft, 4 published, 2 closed) en el orden del listado', async () => {
    const { page, jobs } = await loadSeededJobs();

    expect(page.total).toBe(10);
    expect(page.items.map((item) => item.title)).toEqual(EXPECTED_TITLES);
    expect(SEED_TITLES_IN_LIST_ORDER).toEqual(EXPECTED_TITLES);
    const countBy = (status: Job['status']) => jobs.filter((job) => job.status === status).length;
    expect(countBy('draft')).toBe(4);
    expect(countBy('published')).toBe(4);
    expect(countBy('closed')).toBe(2);
  });

  it('CA-24 todas cumplen RN-02 a RN-04', async () => {
    const { jobs } = await loadSeededJobs();

    for (const job of jobs) {
      // RN-02/RN-03: completas y dentro de dominio.
      expect(job.title.length).toBeGreaterThanOrEqual(3);
      expect(job.title.length).toBeLessThanOrEqual(120);
      expect(job.description).toEqual(expect.any(String));
      expect(job.description?.length).toBeGreaterThan(0);
      expect(job.location).toEqual(expect.any(String));
      expect(job.location?.length).toBeGreaterThanOrEqual(2);
      expect(WORK_MODES).toContain(job.workMode);
      // RN-04: si hay banda, mínimo ≤ máximo; la banda es completa o no hay.
      expect(job.salaryMin === null).toBe(job.salaryMax === null);
      if (job.salaryMin !== null && job.salaryMax !== null) {
        expect(job.salaryMin).toBeLessThanOrEqual(job.salaryMax);
      }
    }
  });

  it('CA-24 fechas coherentes con el estado de cada oferta', async () => {
    const { jobs } = await loadSeededJobs();

    for (const job of jobs) {
      if (job.status === 'draft') {
        expect(job.publishedAt).toBeNull();
        expect(job.closedAt).toBeNull();
        continue;
      }
      expect(job.publishedAt).not.toBeNull();
      expect(job.publishedAt! > job.createdAt).toBe(true);
      if (job.status === 'published') {
        expect(job.closedAt).toBeNull();
      } else {
        expect(job.closedAt).not.toBeNull();
        expect(job.closedAt! > job.publishedAt!).toBe(true);
      }
    }
  });

  it('CA-24 el seed conserva las 4 ofertas de HU-01 y las bandas esperadas', async () => {
    const { jobs } = await loadSeededJobs();

    const withBand = jobs.filter((job) => job.salaryMin !== null).map((job) => job.title);
    expect(withBand.sort()).toEqual(
      [
        'Analista de datos junior',
        'Becario/a de marketing digital',
        'Desarrollador/a backend (Node.js)',
        'Desarrollador/a frontend (React)',
        'Responsable de gestión de nóminas',
        'Técnico/a de selección de personal',
      ].sort(),
    );
    expect(jobs.filter((job) => job.salaryMin === null)).toHaveLength(4);
  });
});
