import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { Application, Stage } from '../../src/modules/applications/schemas.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { advance, insertApplicationAt, reject } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  closeJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
  type TestClock,
} from '../helpers/test-app.ts';

// HU-06 TASK-03 (DT-01, INV-05): cambios de etapa después (o antes) del cierre de la oferta, con el puerto real de
// `applications` y el cierre por la API. Datos inventados.
const PUBLISH_AT = '2026-10-05T08:00:00.000Z';
const START_AT = '2026-10-05T09:00:00.000Z';
const ADVANCE_AT = '2026-10-06T10:00:00.000Z';
const CLOSED_AT = '2026-10-06T22:30:00.000Z';
const INTERVIEW: Stage[] = ['received', 'screening', 'interview'];
const OFFER: Stage[] = [...INTERVIEW, 'offer'];
const STAGE_MISMATCH = { error: { code: 'STAGE_MISMATCH' } };

let app: FastifyInstance;
let db: DatabaseSync;
let clock: TestClock;
let job: Job;

beforeEach(async () => {
  clock = createTestClock(PUBLISH_AT);
  ({ app, db } = createTestApp({ now: clock.now }));
  job = await createPublishedJob(app);
});

afterEach(async () => {
  await app.close();
});

/** Candidata inventada con la inscripción ya en `path` (escrita por SQL) en la oferta publicada. */
async function applyAt(path: Stage[]): Promise<Application> {
  const candidate = await createCandidate(app, {
    fullName: 'Candidata Inventada',
    email: 'candidata.tras.cierre@example.com',
    phone: '+34 600 000 111',
    consent: false,
  });
  return insertApplicationAt(db, {
    jobId: job.id,
    candidateId: candidate.id,
    path,
    startAt: START_AT,
  });
}

async function closeAt(iso: string): Promise<void> {
  clock.set(iso);
  await closeJob(app, job.id);
}

const history = (id: number) => createApplicationsRepository(db).listHistory(id);
const stored = (id: number) => createApplicationsRepository(db).findById(id);

function countOpen(): number {
  const row = db
    .prepare("SELECT COUNT(*) AS open FROM applications WHERE stage NOT IN ('hired', 'rejected')")
    .get();
  return Number(row?.open);
}

describe('cambios de etapa y cierre de la oferta (puerto real)', () => {
  it('CA-07 tras el cierre: advance 409 STAGE_MISMATCH; reject 200 sin cambios con job_closed y nota null', async () => {
    const created = await applyAt(INTERVIEW);
    await closeAt(CLOSED_AT);
    const afterClose = { row: stored(created.id), history: history(created.id) };

    const advanced = await advance(app, created.id, {
      expectedStage: 'interview',
      toStage: 'offer',
    });
    expect(advanced.statusCode).toBe(409);
    expect(advanced.json()).toMatchObject(STAGE_MISMATCH);
    expect(stored(created.id)).toEqual(afterClose.row);
    expect(history(created.id)).toEqual(afterClose.history);

    const rejected = await reject(app, created.id, {
      expectedStage: 'interview',
      reason: 'not_a_fit',
      note: 'Nota inventada que no debe guardarse.',
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json<Application>()).toMatchObject({ id: created.id, stage: 'rejected' });
    expect(stored(created.id)).toEqual(afterClose.row);
    expect(history(created.id)).toEqual(afterClose.history);
    expect(history(created.id).at(-1)).toMatchObject({ reason: 'job_closed', note: null });
  });

  it('EC-21 offer rechazada por cierre → avanzar a hired 409', async () => {
    const created = await applyAt(OFFER);
    await closeAt(CLOSED_AT);
    const afterClose = { row: stored(created.id), history: history(created.id) };

    const response = await advance(app, created.id, { expectedStage: 'offer', toStage: 'hired' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject(STAGE_MISMATCH);
    expect(stored(created.id)).toEqual(afterClose.row);
    expect(history(created.id)).toEqual(afterClose.history);
    expect(countOpen()).toBe(0);
  });

  it('EC-22 avance antes del cierre → StageChange offer → rejected con job_closed', async () => {
    const created = await applyAt(INTERVIEW);
    clock.set(ADVANCE_AT);
    const advanced = await advance(app, created.id, {
      expectedStage: 'interview',
      toStage: 'offer',
    });
    expect(advanced.statusCode).toBe(200);

    await closeAt(CLOSED_AT);

    expect(stored(created.id)).toMatchObject({ stage: 'rejected', lastChangeAt: CLOSED_AT });
    expect(history(created.id).slice(-2)).toEqual([
      { fromStage: 'interview', toStage: 'offer', changedAt: ADVANCE_AT, reason: null, note: null },
      {
        fromStage: 'offer',
        toStage: 'rejected',
        changedAt: CLOSED_AT,
        reason: 'job_closed',
        note: null,
      },
    ]);
    expect(countOpen()).toBe(0);
  });

  it('EC-22 cierre antes del avance → 409 STAGE_MISMATCH y la inscripción sigue rejected', async () => {
    const created = await applyAt(INTERVIEW);
    await closeAt(CLOSED_AT);

    const response = await advance(app, created.id, {
      expectedStage: 'interview',
      toStage: 'offer',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject(STAGE_MISMATCH);
    expect(stored(created.id)).toMatchObject({ stage: 'rejected', lastChangeAt: CLOSED_AT });
    expect(history(created.id).at(-1)).toMatchObject({
      fromStage: 'interview',
      toStage: 'rejected',
      reason: 'job_closed',
    });
    expect(countOpen()).toBe(0);
  });
});
