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

describe('seed — datos de ejemplo (RF-07)', () => {
  it('RF-07 migrate + seed → 4 borradores, 2 con banda, todos cumplen RN-02 a RN-04', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/jobs' });
    expect(list.statusCode).toBe(200);
    const page = list.json<JobPage>();

    expect(page.total).toBe(4);
    expect(page.items.map((item) => item.title)).toEqual([
      'Desarrollador/a frontend (React)',
      'Diseñador/a de producto',
      'Técnico/a de soporte IT',
      'Analista de datos junior',
    ]);
    expect(SEED_TITLES_IN_LIST_ORDER).toEqual(page.items.map((item) => item.title));
    expect(page.items.every((item) => item.status === 'draft')).toBe(true);

    const jobs: Job[] = [];
    for (const item of page.items) {
      const response = await app.inject({ method: 'GET', url: `/api/jobs/${item.id}` });
      expect(response.statusCode).toBe(200);
      jobs.push(response.json<Job>());
    }

    for (const job of jobs) {
      // RN-02/RN-03: completos y dentro de dominio.
      expect(job.title.length).toBeGreaterThanOrEqual(3);
      expect(job.title.length).toBeLessThanOrEqual(120);
      expect(job.description).toEqual(expect.any(String));
      expect(job.description?.length).toBeGreaterThan(0);
      expect(job.location).toEqual(expect.any(String));
      expect(job.location?.length).toBeGreaterThanOrEqual(2);
      expect(WORK_MODES).toContain(job.workMode);
      // RN-04: si hay banda, mínimo ≤ máximo.
      if (job.salaryMin !== null && job.salaryMax !== null) {
        expect(job.salaryMin).toBeLessThanOrEqual(job.salaryMax);
      }
    }
    const withBand = jobs.filter((job) => job.salaryMin !== null && job.salaryMax !== null);
    expect(withBand.map((job) => job.title).sort()).toEqual([
      'Analista de datos junior',
      'Desarrollador/a frontend (React)',
    ]);
    const withoutBand = jobs.filter((job) => job.salaryMin === null && job.salaryMax === null);
    expect(withoutBand).toHaveLength(2);
  });
});
