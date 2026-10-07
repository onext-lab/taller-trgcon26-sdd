import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import { STAGES, type Application, type Stage } from '../../src/modules/applications/schemas.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { createJobStatusReader } from '../../src/modules/jobs/job-status.ts';
import { createJobsRepository } from '../../src/modules/jobs/repository.ts';
import {
  advance,
  createJobStatusSpy,
  enroll,
  insertApplicationAt,
  type JobStatusSpy,
} from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { closeJob, createPublishedJob, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. `START_AT` es el primer paso de las inscripciones sembradas; el reloj corre después.
const START_AT = '2026-10-01T09:00:00.000Z';
const NOW = '2026-10-07T10:00:00.000Z';
const KEYS = ['candidateId', 'createdAt', 'id', 'jobId', 'lastChangeAt', 'stage'];
const MISMATCH = {
  error: {
    code: 'STAGE_MISMATCH',
    message: 'La inscripción ha cambiado de etapa: recarga e inténtalo de nuevo.',
  },
};
const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'La inscripción no existe.' } };

let app: FastifyInstance;
let db: DatabaseSync;
let clock: ReturnType<typeof createTestClock>;
let nowCalls: number;
let jobId: number;
let candidate: Candidate;

/** Reloj que cuenta cuántas veces se le pide la hora; con `withSpy`, el puerto real del estado va envuelto en un espía. */
function boot(withSpy = false): JobStatusSpy | undefined {
  clock = createTestClock(NOW);
  nowCalls = 0;
  const now = () => {
    nowCalls += 1;
    return clock.now();
  };
  db = openDatabase(':memory:');
  migrate(db);
  const reader = createJobStatusReader(createJobsRepository(db));
  const spy = withSpy ? createJobStatusSpy(db, reader) : undefined;
  app = buildApp({ db, now, jobStatus: spy?.port });
  return spy;
}

beforeEach(async () => {
  boot();
  jobId = (await createPublishedJob(app)).id;
  candidate = await newCandidate('candidata.avance@example.com');
});

afterEach(async () => {
  await app.close();
});

function newCandidate(email: string): Promise<Candidate> {
  return createCandidate(app, { fullName: 'Candidata Inventada', email });
}

/** Siembra una inscripción ya en `stage` por SQL (un `StageChange` por paso, un minuto entre cada uno). */
function seedAt(stage: Stage, { job = jobId, owner = candidate } = {}): Application {
  const path: Stage[] =
    stage === 'rejected' ? ['received', stage] : STAGES.slice(0, STAGES.indexOf(stage) + 1);
  const rejection = stage === 'rejected' ? { reason: 'not_a_fit' as const } : {};
  const base = { jobId: job, candidateId: owner.id, path, startAt: START_AT };
  return insertApplicationAt(db, { ...base, ...rejection });
}

const countChanges = (applicationId: number): number => history(applicationId).length;
const history = (applicationId: number) =>
  createApplicationsRepository(db).listHistory(applicationId);
const stored = (applicationId: number) => createApplicationsRepository(db).findById(applicationId);

function totalChanges(): number {
  return Number(db.prepare('SELECT total_changes() AS n').get()?.n);
}

const move = (id: number, expectedStage: Stage, toStage: Stage) =>
  advance(app, id, { expectedStage, toStage });

async function retentionOf(candidateId: number): Promise<string | null> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${candidateId}` });
  return response.json<Candidate>().retentionEndsAt;
}

describe('POST /api/applications/:id/advance — avanzar', () => {
  it('CA-01 screening → interview: 200 Application, lastChangeAt = reloj, StageChange sin motivo ni nota', async () => {
    const created = seedAt('screening');
    const callsBefore = nowCalls;

    const response = await move(created.id, 'screening', 'interview');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...created, stage: 'interview', lastChangeAt: NOW });
    expect(Object.keys(response.json()).sort()).toEqual(KEYS);
    expect(history(created.id).at(-1)).toEqual({
      fromStage: 'screening',
      toStage: 'interview',
      changedAt: NOW,
      reason: null,
      note: null,
    });
    expect(countChanges(created.id)).toBe(3);
    expect(nowCalls - callsBefore).toBe(1);
  });

  it('CA-03 reintento a interview con esperada screening → 200 sin StageChange, lastChangeAt y retención iguales', async () => {
    const created = seedAt('interview');
    const retention = await retentionOf(candidate.id);

    const response = await move(created.id, 'screening', 'interview');

    expect(response.statusCode).toBe(200);
    expect(response.json<Application>().lastChangeAt).toBe(created.lastChangeAt);
    expect(countChanges(created.id)).toBe(3);
    expect(await retentionOf(candidate.id)).toBe(retention);
  });

  it('RV-23 (DT-13) en interview, esperada screening (desactualizada) y destino interview → 200 sin escrituras: 0 StageChange nuevos, lastChangeAt y retención iguales, Application idéntica a la guardada', async () => {
    const created = seedAt('interview');
    const before = stored(created.id);
    const historyBefore = history(created.id);
    const retention = await retentionOf(candidate.id);
    const writesBefore = totalChanges();
    const callsBefore = nowCalls;

    const response = await move(created.id, 'screening', 'interview');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(before);
    expect(response.json()).toEqual(created);
    expect(history(created.id)).toEqual(historyBefore);
    expect(stored(created.id)).toEqual(before);
    expect(await retentionOf(candidate.id)).toBe(retention);
    expect(totalChanges()).toBe(writesBefore);
    expect(nowCalls).toBe(callsBefore);
  });

  it('EC-03 recorrido completo received → hired: 4 StageChange con fechas crecientes', async () => {
    const enrolled = (await enroll(app, jobId, candidate.id)).json<Application>();
    const route: Stage[] = ['received', 'screening', 'interview', 'offer', 'hired'];

    for (const [index, toStage] of route.slice(1).entries()) {
      clock.advance(60_000);
      const expectedStage = route[index]!;
      const response = await move(enrolled.id, expectedStage, toStage);
      expect(response.statusCode).toBe(200);
      expect(response.json<Application>().stage).toBe(toStage);
    }

    const steps = history(enrolled.id);
    expect(steps.map((step) => step.toStage)).toEqual(route);
    const dates = steps.slice(1).map((step) => String(step.changedAt));
    expect(dates).toHaveLength(4);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(4);
    expect(stored(enrolled.id)).toMatchObject({ stage: 'hired', lastChangeAt: dates[3] });
  });
});

describe('POST /api/applications/:id/advance — rechazos', () => {
  it('CA-06 interview con esperada screening y destino offer → 409 STAGE_MISMATCH, nada cambia', async () => {
    const created = seedAt('interview');
    const before = stored(created.id);
    const writesBefore = totalChanges();

    const response = await move(created.id, 'screening', 'offer');

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(MISMATCH);
    expect(stored(created.id)).toEqual(before);
    expect(countChanges(created.id)).toBe(3);
    expect(totalChanges()).toBe(writesBefore);
  });

  // Los tres de CA-07 y los saltos desde las demás etapas no finales (refuerzo de la mutación M3 de la review).
  it.each([
    ['screening', 'offer'],
    ['screening', 'received'],
    ['screening', 'rejected'],
    ['received', 'interview'],
    ['received', 'hired'],
    ['interview', 'hired'],
  ] as const)(
    'CA-07 %s → %s con la esperada al día → 409 INVALID_TRANSITION',
    async (fromStage, toStage) => {
      const created = seedAt(fromStage);
      const before = countChanges(created.id);

      const response = await move(created.id, fromStage, toStage);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: {
          code: 'INVALID_TRANSITION',
          message: 'Solo se puede avanzar a la etapa siguiente.',
        },
      });
      expect(stored(created.id)).toEqual(created);
      expect(countChanges(created.id)).toBe(before);
    },
  );

  it('EC-04 received→received y rejected→rejected con la esperada al día → 409 INVALID_TRANSITION', async () => {
    for (const stage of ['received', 'rejected'] as const) {
      const created = seedAt(stage, { owner: await newCandidate(`ec04.${stage}@example.com`) });

      const response = await move(created.id, stage, stage);

      expect(response.statusCode).toBe(409);
      expect(response.json<{ error: { code: string } }>().error.code).toBe('INVALID_TRANSITION');
      expect(stored(created.id)).toEqual(created);
    }
  });

  it('CA-08 hired y rejected con su etapa como esperada → 409 INVALID_TRANSITION', async () => {
    for (const stage of ['hired', 'rejected'] as const) {
      const created = seedAt(stage, { owner: await newCandidate(`ca08.${stage}@example.com`) });
      const before = countChanges(created.id);

      const response = await move(created.id, stage, 'interview');

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: {
          code: 'INVALID_TRANSITION',
          message: 'La inscripción está en una etapa final: no admite cambios.',
        },
      });
      expect(stored(created.id)).toEqual(created);
      expect(countChanges(created.id)).toBe(before);
    }
  });
});

describe('POST /api/applications/:id/advance — identificadores', () => {
  const BODY = { expectedStage: 'received', toStage: 'screening' };

  it('CA-10 inexistente → 404 sin datos', async () => {
    const writesBefore = totalChanges();

    const response = await advance(app, 4242, BODY);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(NOT_FOUND);
    expect(totalChanges()).toBe(writesBefore);
  });

  it("EC-03 999999999999999 inexistente → 404 sin datos; MAX_SAFE_INTEGER → 400 { field: 'id' }", async () => {
    const missing = await advance(app, '999999999999999', BODY);
    const tooLong = await advance(app, String(Number.MAX_SAFE_INTEGER), BODY);

    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual(NOT_FOUND);
    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json<{ error: { details: { field: string }[] } }>().error.details).toEqual([
      expect.objectContaining({ field: 'id' }),
    ]);
  });
});

describe('POST /api/applications/:id/advance — oferta cerrada (DT-09)', () => {
  let spy: JobStatusSpy;

  beforeEach(async () => {
    // Misma composición que `createTestApp`, con el espía sobre el lector real del estado de la oferta.
    await app.close();
    spy = boot(true)!;
    candidate = await newCandidate('candidata.cerrada@example.com');
  });

  it('CA-39 (DT-09, HU-06 lo revisa) activa de una oferta closed → advance 200 y StageChange interview → offer', async () => {
    // DD-09: la oferta se cierra vacía por la API y la inscripción se escribe después por SQL.
    const closedJob = await closeJob(app, (await createPublishedJob(app)).id);
    expect(closedJob.status).toBe('closed');
    const created = seedAt('interview', { job: closedJob.id });

    const response = await move(created.id, 'interview', 'offer');

    expect(response.statusCode).toBe(200);
    expect(response.json<Application>()).toEqual({ ...created, stage: 'offer', lastChangeAt: NOW });
    expect(history(created.id).at(-1)).toMatchObject({
      fromStage: 'interview',
      toStage: 'offer',
      changedAt: NOW,
    });
    expect(spy.insideTransaction).toEqual([]);
  });
});
