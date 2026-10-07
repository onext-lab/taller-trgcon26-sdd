import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertApplicationWithHistory } from '../../src/db/seed-applications.ts';
import { withTransaction } from '../../src/db/transaction.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { ApplicationDetail, Pipeline, Stage } from '../../src/modules/applications/schemas.ts';
import { createCandidatesRepository } from '../../src/modules/candidates/repository.ts';
import { createJobsRepository } from '../../src/modules/jobs/repository.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';
import { advance, enroll, getApplication, reject } from '../helpers/applications.ts';

// Datos inventados. Lectura del pipeline, inscribir, avanzar, rechazar y detalle con 1 000 candidatos y 2 000 inscripciones.
const NOW = '2026-10-06T22:30:00.000Z';
const CANDIDATES_IN_DB = 1000;
const JOBS_IN_DB = 10;
const APPLICATIONS_PER_JOB = 200;
const REPETITIONS = 3;
const READ_BUDGET_MS = 200;
const WRITE_BUDGET_MS = 500;
const PATHS: readonly (readonly Stage[])[] = [
  ['received'],
  ['received', 'screening'],
  ['received', 'screening', 'interview'],
  ['received', 'screening', 'interview', 'offer'],
  ['received', 'screening', 'interview', 'offer', 'hired'],
];

let app: FastifyInstance;
let db: DatabaseSync;
let jobIds: number[];
let candidateIds: number[];

/** Instante `minutes` antes de `NOW`, en ISO UTC. */
function minutesAgo(minutes: number): string {
  return new Date(Date.parse(NOW) - minutes * 60_000).toISOString();
}

function insertJobs(db: DatabaseSync): void {
  const jobs = createJobsRepository(db);
  for (let n = 0; n < JOBS_IN_DB; n += 1) {
    const { id } = jobs.insert(
      {
        title: `Oferta de rendimiento ${n}`,
        description: 'Descripción inventada para medir tiempos.',
        location: 'Valladolid',
        workMode: 'remota',
      },
      minutesAgo(60_000),
    );
    jobs.markPublished(id, minutesAgo(50_000));
    jobIds.push(id);
  }
}

function insertCandidates(db: DatabaseSync): void {
  const candidates = createCandidatesRepository(db);
  for (let n = 0; n < CANDIDATES_IN_DB; n += 1) {
    const fields = {
      fullName: `José Rendimiento ${n}`,
      email: `rendimiento${n}@example.com`,
      phone: null,
      summary: null,
      skills: [],
    };
    candidateIds.push(candidates.insert(fields, minutesAgo(40_000 + n), null));
  }
}

/** Cada oferta recibe 200 candidatos consecutivos (en círculo): 2 000 inscripciones, 2 por candidato. */
function insertApplications(db: DatabaseSync): void {
  const applications = createApplicationsRepository(db);
  jobIds.forEach((jobId, jobPosition) => {
    for (let n = 0; n < APPLICATIONS_PER_JOB; n += 1) {
      const candidateIndex = (jobPosition * 100 + n) % CANDIDATES_IN_DB;
      const path = PATHS[(jobPosition + n) % PATHS.length]!;
      const steps = path.map((stage, step) => ({
        stage,
        at: minutesAgo(30_000 - jobPosition * 1000 - n * 5 - step),
      }));
      insertApplicationWithHistory(applications, {
        candidateId: candidateIds[candidateIndex]!,
        jobId,
        steps,
      });
    }
  });
}

beforeEach(() => {
  const created = createTestApp({ now: createTestClock(NOW).now });
  app = created.app;
  db = created.db;
  jobIds = [];
  candidateIds = [];
  withTransaction(created.db, () => {
    insertJobs(created.db);
    insertCandidates(created.db);
    insertApplications(created.db);
  });
});

afterEach(async () => {
  await app.close();
});

/** Mide una petición; devuelve la respuesta y los milisegundos. */
async function timed(
  options: InjectOptions,
): Promise<{ response: LightMyRequestResponse; elapsedMs: number }> {
  const start = performance.now();
  const response = await app.inject(options);
  return { response, elapsedMs: performance.now() - start };
}

/** IDs de las primeras inscripciones que están en `stage` (la semilla reparte las 5 trayectorias por igual). */
function applicationIdsAt(stage: Stage, count: number): number[] {
  const rows = db
    .prepare('SELECT id FROM applications WHERE stage = ? ORDER BY id LIMIT ?')
    .all(stage, count) as { id: number }[];
  return rows.map((row) => row.id);
}

describe('rendimiento de inscripciones con 1 000 candidatos y 2 000 inscripciones', () => {
  it('RNF-01 pipeline de 200 < 200 ms con 1 000 candidatos y 2 000 inscripciones', async () => {
    const options = { method: 'GET', url: `/api/jobs/${jobIds[0]!}/applications` } as const;
    await app.inject(options);
    let worst = 0;
    for (let n = 0; n < REPETITIONS; n += 1) {
      const { response, elapsedMs } = await timed(options);
      expect(response.statusCode).toBe(200);
      expect(response.json<Pipeline>().items).toHaveLength(APPLICATIONS_PER_JOB);
      worst = Math.max(worst, elapsedMs);
    }

    expect(worst).toBeLessThan(READ_BUDGET_MS);
  });

  it('RNF-02 POST /api/applications < 500 ms', async () => {
    const times: number[] = [];
    // Candidatos 500-502: ninguno está inscrito en la primera oferta (que recibió del 0 al 199).
    for (const index of [500, 501, 502]) {
      const start = performance.now();
      const response = await enroll(app, jobIds[0]!, candidateIds[index]!);
      times.push(performance.now() - start);
      expect(response.statusCode).toBe(201);
    }

    expect(Math.max(...times)).toBeLessThan(WRITE_BUDGET_MS);
  });

  it('RNF-01 advance y reject < 500 ms con 1 000 candidatos y 2 000 inscripciones', async () => {
    const times: number[] = [];
    for (const id of applicationIdsAt('received', REPETITIONS)) {
      const start = performance.now();
      const response = await advance(app, id, { expectedStage: 'received', toStage: 'screening' });
      times.push(performance.now() - start);
      expect(response.statusCode).toBe(200);
    }
    for (const id of applicationIdsAt('screening', REPETITIONS)) {
      const start = performance.now();
      const response = await reject(app, id, { expectedStage: 'screening', reason: 'other' });
      times.push(performance.now() - start);
      expect(response.statusCode).toBe(200);
    }

    expect(times).toHaveLength(2 * REPETITIONS);
    expect(Math.max(...times)).toBeLessThan(WRITE_BUDGET_MS);
  });

  it('RNF-02 detalle con 5 cambios < 200 ms', async () => {
    const [id] = applicationIdsAt('hired', 1);
    await getApplication(app, id!);
    let worst = 0;
    for (let n = 0; n < REPETITIONS; n += 1) {
      const start = performance.now();
      const response = await getApplication(app, id!);
      worst = Math.max(worst, performance.now() - start);
      expect(response.statusCode).toBe(200);
      expect(response.json<ApplicationDetail>().history).toHaveLength(5);
    }

    expect(worst).toBeLessThan(READ_BUDGET_MS);
  });
});
