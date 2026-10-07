import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import {
  STAGES,
  type Application,
  type RejectionReason,
  type Stage,
} from '../../src/modules/applications/schemas.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { createJobStatusReader } from '../../src/modules/jobs/job-status.ts';
import { createJobsRepository } from '../../src/modules/jobs/repository.ts';
import {
  advance,
  createJobStatusSpy,
  insertApplicationAt,
  reject,
  type JobStatusSpy,
} from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { closeJob, createPublishedJob, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. `START_AT` es el primer paso de las inscripciones sembradas; el reloj corre después.
const START_AT = '2026-10-01T09:00:00.000Z';
const NOW = '2026-10-07T10:00:00.000Z';
const LATER = '2026-11-20T08:00:00.000Z';
const NOTE = 'Prefiere jornada parcial.';
const OTHER_NOTE = 'Ya tiene otra oferta aceptada.';
const KEYS = ['candidateId', 'createdAt', 'id', 'jobId', 'lastChangeAt', 'stage'];

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
  candidate = await createCandidate(app, {
    fullName: 'Candidata Inventada',
    email: 'candidata.rechazo@example.com',
  });
});

afterEach(async () => {
  await app.close();
});

/** Siembra una inscripción ya en `stage` por SQL (un `StageChange` por paso, un minuto entre cada uno). */
function seedAt(
  stage: Stage,
  extra: { job?: number; reason?: RejectionReason; note?: string; path?: Stage[] } = {},
): Application {
  const { job = jobId, path = STAGES.slice(0, STAGES.indexOf(stage) + 1), ...rejection } = extra;
  const base = { jobId: job, candidateId: candidate.id, path, startAt: START_AT };
  return insertApplicationAt(db, { ...base, ...rejection });
}

const history = (applicationId: number) =>
  createApplicationsRepository(db).listHistory(applicationId);
const stored = (applicationId: number) => createApplicationsRepository(db).findById(applicationId);

function totalChanges(): number {
  return Number(db.prepare('SELECT total_changes() AS n').get()?.n);
}

async function retentionOf(candidateId: number): Promise<string | null> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${candidateId}` });
  return response.json<Candidate>().retentionEndsAt;
}

describe('POST /api/applications/:id/reject — rechazar', () => {
  it('CA-12 interview rechazada con not_a_fit y nota → 200 (6 claves, sin nota), StageChange con ambos, retención recalculada', async () => {
    const created = seedAt('interview');
    // Sin inscripciones finales, la retención es el alta + 6 meses; al rechazar pasa al cierre + 6 meses.
    expect(await retentionOf(candidate.id)).toBe('2027-04-07');
    clock.set(LATER);
    const callsBefore = nowCalls;

    const response = await reject(app, created.id, {
      expectedStage: 'interview',
      reason: 'not_a_fit',
      note: NOTE,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...created, stage: 'rejected', lastChangeAt: LATER });
    expect(Object.keys(response.json()).sort()).toEqual(KEYS);
    expect(response.body).not.toContain(NOTE);
    expect(history(created.id).at(-1)).toEqual({
      fromStage: 'interview',
      toStage: 'rejected',
      changedAt: LATER,
      reason: 'not_a_fit',
      note: NOTE,
    });
    expect(history(created.id)).toHaveLength(4);
    expect(nowCalls - callsBefore).toBe(1);
    expect(await retentionOf(candidate.id)).toBe('2027-05-20');
  });

  it('CA-14 reintento con otro motivo y otra nota → 200 sin StageChange, originales intactos', async () => {
    const created = seedAt('interview');
    const first = await reject(app, created.id, {
      expectedStage: 'interview',
      reason: 'not_a_fit',
      note: NOTE,
    });
    const rejected = first.json<Application>();
    const historyBefore = history(created.id);
    const retention = await retentionOf(candidate.id);
    const writesBefore = totalChanges();

    const retry = await reject(app, created.id, {
      expectedStage: 'interview',
      reason: 'other',
      note: OTHER_NOTE,
    });

    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(rejected);
    expect(history(created.id)).toEqual(historyBefore);
    expect(history(created.id).at(-1)).toMatchObject({ reason: 'not_a_fit', note: NOTE });
    expect(await retentionOf(candidate.id)).toBe(retention);
    expect(totalChanges()).toBe(writesBefore);
  });

  it('RV-23 (DT-13) ya rejected con not_a_fit y nota, esperada interview (desactualizada), motivo other y otra nota → 200 sin escrituras: motivo y nota guardados intactos, 0 StageChange nuevos, Application idéntica a la guardada', async () => {
    const created = seedAt('rejected', {
      path: ['received', 'screening', 'rejected'],
      reason: 'not_a_fit',
      note: NOTE,
    });
    const before = stored(created.id);
    const historyBefore = history(created.id);
    const writesBefore = totalChanges();
    const callsBefore = nowCalls;
    const retention = await retentionOf(candidate.id);

    const response = await reject(app, created.id, {
      expectedStage: 'interview',
      reason: 'other',
      note: OTHER_NOTE,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(before);
    expect(response.json()).toEqual(created);
    expect(history(created.id)).toEqual(historyBefore);
    expect(history(created.id).at(-1)).toMatchObject({ reason: 'not_a_fit', note: NOTE });
    expect(stored(created.id)).toEqual(before);
    expect(await retentionOf(candidate.id)).toBe(retention);
    expect(totalChanges()).toBe(writesBefore);
    expect(nowCalls).toBe(callsBefore);
  });

  it('EC-16 rejected con job_closed (insertApplicationAt) → 200; conserva job_closed y note null', async () => {
    const created = seedAt('rejected', { path: ['received', 'rejected'], reason: 'job_closed' });

    const response = await reject(app, created.id, { expectedStage: 'rejected', reason: 'other' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(created);
    expect(history(created.id).at(-1)).toMatchObject({ reason: 'job_closed', note: null });
  });
});

describe('POST /api/applications/:id/reject — errores', () => {
  it.each([
    ['sin motivo', { expectedStage: 'interview' }],
    ['motivo foo', { expectedStage: 'interview', reason: 'foo' }],
    ['motivo job_closed', { expectedStage: 'interview', reason: 'job_closed' }],
  ])('CA-15 %s → 400 y nada cambia', async (_label, body) => {
    const created = seedAt('interview');
    const writesBefore = totalChanges();

    const response = await reject(app, created.id, body);

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
    expect(stored(created.id)).toEqual(created);
    expect(totalChanges()).toBe(writesBefore);
  });

  it('CA-17 esperada screening sobre interview → 409 STAGE_MISMATCH, sigue en interview', async () => {
    const created = seedAt('interview');
    const writesBefore = totalChanges();

    const response = await reject(app, created.id, { expectedStage: 'screening', reason: 'other' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'STAGE_MISMATCH',
        message: 'La inscripción ha cambiado de etapa: recarga e inténtalo de nuevo.',
      },
    });
    expect(stored(created.id)).toEqual(created);
    expect(totalChanges()).toBe(writesBefore);
  });

  it('CA-18 hired con esperada hired → 409 INVALID_TRANSITION', async () => {
    const created = seedAt('hired');

    const response = await reject(app, created.id, { expectedStage: 'hired', reason: 'other' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_TRANSITION',
        message: 'Una inscripción contratada no se puede rechazar.',
      },
    });
    expect(stored(created.id)).toEqual(created);
  });

  it('CA-19 inexistente → 404 sin datos', async () => {
    const writesBefore = totalChanges();

    const response = await reject(app, 4242, { expectedStage: 'received', reason: 'other' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'La inscripción no existe.' },
    });
    expect(totalChanges()).toBe(writesBefore);
  });
});

describe('POST /api/applications/:id/reject — oferta cerrada (DT-09)', () => {
  let spy: JobStatusSpy;

  beforeEach(async () => {
    // Misma composición que `createTestApp`, con el espía sobre el lector real del estado de la oferta.
    await app.close();
    spy = boot(true)!;
    candidate = await createCandidate(app, {
      fullName: 'Candidata Inventada',
      email: 'candidata.cerrada@example.com',
    });
  });

  it('DT-09 (HU-06 lo revisa) rechazar una activa de una closed → 200 y StageChange interview → rejected', async () => {
    // DD-09: la oferta se cierra vacía por la API y la inscripción se escribe después por SQL.
    const closedJob = await closeJob(app, (await createPublishedJob(app)).id);
    expect(closedJob.status).toBe('closed');
    const created = seedAt('interview', { job: closedJob.id });

    const response = await reject(app, created.id, { expectedStage: 'interview', reason: 'other' });

    expect(response.statusCode).toBe(200);
    expect(response.json<Application>()).toEqual({
      ...created,
      stage: 'rejected',
      lastChangeAt: NOW,
    });
    expect(history(created.id).at(-1)).toMatchObject({
      fromStage: 'interview',
      toStage: 'rejected',
      changedAt: NOW,
      reason: 'other',
    });
  });

  it('DT-09 (HU-06 lo revisa) ni advance ni reject llaman al puerto de estado: espía sin llamadas', async () => {
    const otherJob = await createPublishedJob(app, { title: 'Otra oferta inventada' });
    const toAdvance = seedAt('screening', { job: otherJob.id });
    const toReject = seedAt('screening', { job: (await createPublishedJob(app)).id });

    const body = { expectedStage: 'screening' };
    const advanced = await advance(app, toAdvance.id, { ...body, toStage: 'interview' });
    const rejected = await reject(app, toReject.id, { ...body, reason: 'other' });

    expect(advanced.json<Application>().stage).toBe('interview');
    expect(rejected.json<Application>().stage).toBe('rejected');
    expect(spy.insideTransaction).toEqual([]);
  });
});
