import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertApplicationWithHistory } from '../../src/db/seed-applications.ts';
import { withTransaction } from '../../src/db/transaction.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { Stage } from '../../src/modules/applications/schemas.ts';
import { createCandidatesRepository } from '../../src/modules/candidates/repository.ts';
import { createJobsRepository } from '../../src/modules/jobs/repository.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. Cierre y previa con 1 000 candidatos y 2 000 inscripciones, 200 activas en cada oferta medida.
const NOW = '2026-10-06T22:30:00.000Z';
const CANDIDATES_IN_DB = 1000;
const APPLICATIONS_PER_JOB = 200;
const JOBS_IN_DB = 10;
/** Las 4 primeras ofertas tienen solo activas: la 0 calienta y las 1-3 se miden. */
const ACTIVE_ONLY_JOBS = 4;
const REPETITIONS = 3;
const PREVIEW_BUDGET_MS = 200;
const CLOSE_BUDGET_MS = 500;
const ACTIVE_PATHS: readonly (readonly Stage[])[] = [
  ['received'],
  ['received', 'screening'],
  ['received', 'screening', 'interview'],
  ['received', 'screening', 'interview', 'offer'],
];
const MIXED_PATHS: readonly (readonly Stage[])[] = [
  ...ACTIVE_PATHS,
  ['received', 'screening', 'interview', 'offer', 'hired'],
  ['received', 'screening'],
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
        title: `Oferta de cierre ${n}`,
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
      fullName: `Candidata Rendimiento ${String(n).padStart(4, '0')}`,
      email: `rendimiento.${String(n).padStart(4, '0')}@example.com`,
      phone: null,
      summary: null,
      skills: [],
    };
    candidateIds.push(candidates.insert(fields, minutesAgo(40_000 + n), null));
  }
}

/**
 * Cada oferta recibe 200 candidatos consecutivos (en círculo, así que ninguno se repite en la misma oferta): 2 000
 * inscripciones. Las ofertas medidas solo tienen etapas no finales; el resto, etapas mezcladas con finales.
 */
function insertApplications(db: DatabaseSync): void {
  const applications = createApplicationsRepository(db);
  jobIds.forEach((jobId, jobPosition) => {
    const paths = jobPosition < ACTIVE_ONLY_JOBS ? ACTIVE_PATHS : MIXED_PATHS;
    for (let n = 0; n < APPLICATIONS_PER_JOB; n += 1) {
      const path = paths[(jobPosition + n) % paths.length]!;
      const steps = path.map((stage, step) => ({
        stage,
        at: minutesAgo(30_000 - jobPosition * 1000 - n * 5 - step),
      }));
      insertApplicationWithHistory(applications, {
        candidateId: candidateIds[(jobPosition * 100 + n) % CANDIDATES_IN_DB]!,
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

function previewOf(jobId: number): InjectOptions {
  return { method: 'GET', url: `/api/jobs/${jobId}/close-preview` };
}

function closeOf(jobId: number): InjectOptions {
  return { method: 'POST', url: `/api/jobs/${jobId}/close` };
}

function countNonFinal(jobId: number): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS total FROM applications WHERE job_id = ? AND stage NOT IN ('hired', 'rejected')",
    )
    .get(jobId) as { total: number };
  return row.total;
}

/** Calentamiento sin medir: una previa y un cierre sobre la oferta 0, para no medir la compilación de sentencias. */
async function warmUp(): Promise<void> {
  const warmJobId = jobIds[0]!;
  expect((await app.inject(previewOf(warmJobId))).statusCode).toBe(200);
  expect((await app.inject(closeOf(warmJobId))).statusCode).toBe(200);
}

describe('rendimiento del cierre y de la previa con 200 activas', () => {
  it('RNF-02 previa con 200 activas < 200 ms', async () => {
    await warmUp();
    const times: number[] = [];
    for (const jobId of jobIds.slice(1, 1 + REPETITIONS)) {
      expect(countNonFinal(jobId)).toBe(APPLICATIONS_PER_JOB);
      const { response, elapsedMs } = await timed(previewOf(jobId));
      times.push(elapsedMs);
      expect(response.statusCode).toBe(200);
      expect(response.json<{ activeApplications: number }>()).toEqual({
        activeApplications: APPLICATIONS_PER_JOB,
      });
    }

    console.log(`RNF-02 previa (ms): ${times.map((t) => t.toFixed(1)).join(', ')}`);
    expect(times).toHaveLength(REPETITIONS);
    expect(Math.max(...times)).toBeLessThan(PREVIEW_BUDGET_MS);
  });

  it('RNF-01 cierre con 200 activas < 500 ms', async () => {
    await warmUp();
    const times: number[] = [];
    for (const jobId of jobIds.slice(1, 1 + REPETITIONS)) {
      expect(countNonFinal(jobId)).toBe(APPLICATIONS_PER_JOB);
      const { response, elapsedMs } = await timed(closeOf(jobId));
      times.push(elapsedMs);
      expect(response.statusCode).toBe(200);
      expect(countNonFinal(jobId)).toBe(0);
    }

    console.log(`RNF-01 cierre (ms): ${times.map((t) => t.toFixed(1)).join(', ')}`);
    expect(times).toHaveLength(REPETITIONS);
    expect(Math.max(...times)).toBeLessThan(CLOSE_BUDGET_MS);
  });
});
