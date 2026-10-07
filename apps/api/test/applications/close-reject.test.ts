import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { Stage } from '../../src/modules/applications/schemas.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { enroll, insertApplicationAt } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  closeJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
  type TestClock,
} from '../helpers/test-app.ts';

// HU-06 TASK-02: cierre de oferta por la API con el puerto real de `applications` (sin `jobApplications`). Datos
// inventados. El cierre es posterior a `created_at` de todas las inscripciones (CHECK last_change_at >= created_at).
const PUBLISH_AT = '2026-10-05T08:00:00.000Z';
const START_AT = '2026-10-05T09:00:00.000Z';
const CLOSED_AT = '2026-10-06T22:30:00.000Z';
const ONE_HOUR_MS = 60 * 60 * 1000;
const RETENTION_AFTER_CLOSE = '2027-04-07';
const RECEIVED: Stage[] = ['received'];
const OFFER: Stage[] = ['received', 'screening', 'interview', 'offer'];
const HIRED: Stage[] = [...OFFER, 'hired'];

let app: FastifyInstance;
let db: DatabaseSync;
let clock: TestClock;
let job: Job;
let candidateCount = 0;

beforeEach(async () => {
  clock = createTestClock(PUBLISH_AT);
  ({ app, db } = createTestApp({ now: clock.now }));
  job = await createPublishedJob(app);
});

afterEach(async () => {
  await app.close();
});

async function newCandidate(): Promise<Candidate> {
  candidateCount += 1;
  return createCandidate(app, {
    fullName: `Candidata Inventada ${candidateCount}`,
    email: `candidata.cierre.${candidateCount}@example.com`,
    phone: `+34 600 000 ${String(candidateCount).padStart(3, '0')}`,
    consent: false,
  });
}

/** Candidato nuevo con la inscripción ya en `path` (escrita por SQL: no recalcula la retención). */
async function applyAt(
  jobId: number,
  path: Stage[],
  extra: { reason?: 'not_a_fit'; note?: string } = {},
) {
  const candidate = await newCandidate();
  const application = insertApplicationAt(db, {
    jobId,
    candidateId: candidate.id,
    path,
    startAt: START_AT,
    ...extra,
  });
  return { candidate, application };
}

const history = (applicationId: number) =>
  createApplicationsRepository(db).listHistory(applicationId);
const stored = (applicationId: number) => createApplicationsRepository(db).findById(applicationId);

function count(table: 'stage_changes' | 'applications'): number {
  return Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n);
}

async function retentionOf(candidateId: number): Promise<string | null> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${candidateId}` });
  return response.json<Candidate>().retentionEndsAt;
}

async function previewOf(jobId: number): Promise<unknown> {
  const response = await app.inject({ method: 'GET', url: `/api/jobs/${jobId}/close-preview` });
  return response.json();
}

function expectRejectedByClose(applicationId: number, fromStage: Stage): void {
  expect(stored(applicationId)).toMatchObject({ stage: 'rejected', lastChangeAt: CLOSED_AT });
  expect(history(applicationId).at(-1)).toEqual({
    fromStage,
    toStage: 'rejected',
    changedAt: CLOSED_AT,
    reason: 'job_closed',
    note: null,
  });
}

describe('POST /api/jobs/:id/close — rechazo de las inscripciones activas (puerto real)', () => {
  it('CA-01 previa 2; cierre rechaza received y offer con job_closed en closedAt; hired intacta', async () => {
    const received = await applyAt(job.id, RECEIVED);
    const offer = await applyAt(job.id, OFFER);
    const hired = await applyAt(job.id, HIRED);
    const hiredBefore = {
      row: stored(hired.application.id),
      history: history(hired.application.id),
    };
    const changesBefore = count('stage_changes');

    expect(await previewOf(job.id)).toEqual({ activeApplications: 2 });
    clock.set(CLOSED_AT);
    const response = await app.inject({ method: 'POST', url: `/api/jobs/${job.id}/close` });

    expect(response.statusCode).toBe(200);
    expect(response.json<Job>()).toEqual({ ...job, status: 'closed', closedAt: CLOSED_AT });
    expectRejectedByClose(received.application.id, 'received');
    expectRejectedByClose(offer.application.id, 'offer');
    expect(stored(hired.application.id)).toEqual(hiredBefore.row);
    expect(history(hired.application.id)).toEqual(hiredBefore.history);
    expect(count('stage_changes')).toBe(changesBefore + 2);
    expect(await previewOf(job.id)).toEqual({ activeApplications: 0 });
  });

  it('CA-02 los rechazados sin otras abiertas quedan con retención 2027-04-07; la del contratado no cambia', async () => {
    const received = await applyAt(job.id, RECEIVED);
    const offer = await applyAt(job.id, OFFER);
    const hired = await applyAt(job.id, HIRED);
    const hiredRetention = await retentionOf(hired.candidate.id);

    clock.set(CLOSED_AT);
    await closeJob(app, job.id);

    expect(await retentionOf(received.candidate.id)).toBe(RETENTION_AFTER_CLOSE);
    expect(await retentionOf(offer.candidate.id)).toBe(RETENTION_AFTER_CLOSE);
    expect(await retentionOf(hired.candidate.id)).toBe(hiredRetention);
  });

  it('CA-03/EC-04 inscrita tras la previa también se rechaza; inscribir tras el cierre → 409 INVALID_TRANSITION', async () => {
    const first = await applyAt(job.id, RECEIVED);
    expect(await previewOf(job.id)).toEqual({ activeApplications: 1 });
    const late = await newCandidate();
    const enrolled = await enroll(app, job.id, late.id);
    expect(enrolled.statusCode).toBe(201);
    const lateId = enrolled.json<{ id: number }>().id;

    clock.set(CLOSED_AT);
    await closeJob(app, job.id);

    expectRejectedByClose(first.application.id, 'received');
    expectRejectedByClose(lateId, 'received');
    const after = await enroll(app, job.id, (await newCandidate()).id);
    expect(after.statusCode).toBe(409);
    expect(after.json<{ error: { code: string } }>().error.code).toBe('INVALID_TRANSITION');
    expect(count('applications')).toBe(2);
  });

  it('CA-04 sin activas o todas finales: closed, 0 StageChange y retenciones iguales', async () => {
    const withFinals = await createPublishedJob(app, { title: 'Oferta con finales' });
    const hired = await applyAt(withFinals.id, HIRED);
    const rejected = await applyAt(withFinals.id, ['received', 'rejected'], {
      reason: 'not_a_fit',
    });
    const retentions = [
      await retentionOf(hired.candidate.id),
      await retentionOf(rejected.candidate.id),
    ];
    const changesBefore = count('stage_changes');
    clock.set(CLOSED_AT);

    for (const target of [job.id, withFinals.id]) {
      const closed = await closeJob(app, target);
      expect(closed).toMatchObject({ status: 'closed', closedAt: CLOSED_AT });
    }

    expect(count('stage_changes')).toBe(changesBefore);
    expect([
      await retentionOf(hired.candidate.id),
      await retentionOf(rejected.candidate.id),
    ]).toEqual(retentions);
  });

  it('CA-05 con otra abierta en B: A rechazada, B intacta, retención null', async () => {
    const other = await createPublishedJob(app, { title: 'Oferta B abierta' });
    const candidate = await newCandidate();
    const base = { candidateId: candidate.id, path: RECEIVED, startAt: START_AT };
    const inA = insertApplicationAt(db, { ...base, jobId: job.id });
    const inB = insertApplicationAt(db, { ...base, jobId: other.id });
    const inBHistory = history(inB.id);

    clock.set(CLOSED_AT);
    await closeJob(app, job.id);

    expectRejectedByClose(inA.id, 'received');
    expect(stored(inB.id)).toEqual(inB);
    expect(history(inB.id)).toEqual(inBHistory);
    expect(await retentionOf(candidate.id)).toBeNull();
  });

  it('CA-09 buildApp sin jobApplications rechaza con el puerto real', async () => {
    const plainDb = openDatabase(':memory:');
    migrate(plainDb);
    const plain = buildApp({ db: plainDb, now: clock.now });
    try {
      const published = await createPublishedJob(plain);
      const candidate = await createCandidate(plain, {
        fullName: 'Candidata Inventada Directa',
        email: 'candidata.directa@example.com',
      });
      const application = insertApplicationAt(plainDb, {
        jobId: published.id,
        candidateId: candidate.id,
        path: OFFER,
        startAt: START_AT,
      });

      clock.set(CLOSED_AT);
      await closeJob(plain, published.id);

      const reader = createApplicationsRepository(plainDb);
      expect(reader.findById(application.id)).toMatchObject({ stage: 'rejected' });
      expect(reader.listHistory(application.id).at(-1)).toMatchObject({
        fromStage: 'offer',
        reason: 'job_closed',
      });
    } finally {
      await plain.close();
    }
  });

  it('CA-10/EC-20 segundo cierre 1 h después: closedAt original, 0 StageChange, retenciones iguales', async () => {
    const received = await applyAt(job.id, RECEIVED);
    clock.set(CLOSED_AT);
    const first = await closeJob(app, job.id);
    const changesBefore = count('stage_changes');
    const retention = await retentionOf(received.candidate.id);

    clock.advance(ONE_HOUR_MS);
    const second = await closeJob(app, job.id);

    expect(second).toEqual(first);
    expect(second.closedAt).toBe(CLOSED_AT);
    expect(count('stage_changes')).toBe(changesBefore);
    expect(await retentionOf(received.candidate.id)).toBe(retention);
  });

  it('EC-02 6 etapas: 4 rechazadas; hired y rechazo manual (motivo y nota) intactos; retención 2027-04-07', async () => {
    const note = 'Nota inventada de rechazo manual.';
    const received = await applyAt(job.id, RECEIVED);
    const screening = await applyAt(job.id, ['received', 'screening']);
    const interview = await applyAt(job.id, ['received', 'screening', 'interview']);
    const offer = await applyAt(job.id, OFFER);
    const hired = await applyAt(job.id, HIRED);
    const manual = await applyAt(job.id, ['received', 'rejected'], { reason: 'not_a_fit', note });
    const untouched = [hired, manual].map(({ application }) => ({
      row: stored(application.id),
      history: history(application.id),
    }));

    clock.set(CLOSED_AT);
    await closeJob(app, job.id);

    const closedByJob: [typeof received, Stage][] = [
      [received, 'received'],
      [screening, 'screening'],
      [interview, 'interview'],
      [offer, 'offer'],
    ];
    for (const [entry, fromStage] of closedByJob) {
      expectRejectedByClose(entry.application.id, fromStage);
      expect(await retentionOf(entry.candidate.id)).toBe(RETENTION_AFTER_CLOSE);
    }
    expect([hired, manual].map(({ application }) => stored(application.id))).toEqual(
      untouched.map(({ row }) => row),
    );
    expect(history(manual.application.id)).toEqual(untouched[1]?.history);
    expect(history(manual.application.id).at(-1)).toMatchObject({ reason: 'not_a_fit', note });
    expect(history(hired.application.id)).toEqual(untouched[0]?.history);
  });

  it('EC-05 inscrita con la retención vencida → cierre + 6 meses (RGPD §7, cuestión 4)', async () => {
    const { candidate, application } = await applyAt(job.id, RECEIVED);
    db.prepare('UPDATE candidates SET retention_ends_at = ? WHERE id = ?').run(
      '2026-01-01',
      candidate.id,
    );
    expect(await retentionOf(candidate.id)).toBe('2026-01-01');

    clock.set(CLOSED_AT);
    await closeJob(app, job.id);

    expectRejectedByClose(application.id, 'received');
    expect(await retentionOf(candidate.id)).toBe(RETENTION_AFTER_CLOSE);
  });
});
