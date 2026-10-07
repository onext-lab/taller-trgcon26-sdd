import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  ApplicationDetail,
  RejectionReason,
  Stage,
} from '../../src/modules/applications/schemas.ts';
import {
  createJobStatusStub,
  getApplication,
  insertApplicationAt,
  reject,
} from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  closeJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Los instantes salen de `insertApplicationAt`: un minuto entre cada paso.
const START_AT = '2026-10-01T09:00:00.000Z';
const NOW = '2026-10-07T10:00:00.000Z';
const EMAIL = 'candidata.detalle@example.com';
const PHONE = '+34 600 000 000';

let app: FastifyInstance;
let db: DatabaseSync;
let jobId: number;
let candidateId: number;

async function setUp(options: Parameters<typeof createTestApp>[0] = {}): Promise<void> {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now, ...options }));
  jobId = (await createPublishedJob(app, { title: 'Técnica/o de selección' })).id;
  candidateId = (
    await createCandidate(app, {
      fullName: 'Candidata Inventada',
      email: EMAIL,
      phone: PHONE,
      summary: 'Resumen inventado.',
    })
  ).id;
}

beforeEach(async () => {
  await setUp();
});

afterEach(async () => {
  await app.close();
});

/** La inscripción llega a la última etapa de `path`, con un cambio por etapa. */
function seed(path: readonly Stage[], extra: { reason?: RejectionReason; note?: string } = {}) {
  return insertApplicationAt(db, { jobId, candidateId, path, startAt: START_AT, ...extra });
}

async function detailOf(id: number) {
  const response = await getApplication(app, id);
  expect(response.statusCode).toBe(200);
  return response.json<ApplicationDetail>();
}

describe('GET /api/applications/:id', () => {
  it('CA-24 3 cambios en orden con candidate, job.title y job.status', async () => {
    const created = seed(['received', 'screening', 'interview']);

    const response = await getApplication(app, created.id);

    expect(response.statusCode).toBe(200);
    expect(response.json<ApplicationDetail>()).toEqual({
      id: created.id,
      stage: 'interview',
      createdAt: created.createdAt,
      lastChangeAt: '2026-10-01T09:02:00.000Z',
      candidate: { id: candidateId, fullName: 'Candidata Inventada' },
      job: { id: jobId, title: 'Técnica/o de selección', status: 'published' },
      history: [
        { fromStage: null, toStage: 'received', changedAt: START_AT, reason: null, note: null },
        {
          fromStage: 'received',
          toStage: 'screening',
          changedAt: '2026-10-01T09:01:00.000Z',
          reason: null,
          note: null,
        },
        {
          fromStage: 'screening',
          toStage: 'interview',
          changedAt: '2026-10-01T09:02:00.000Z',
          reason: null,
          note: null,
        },
      ],
    });
    expect(response.body).not.toContain(EMAIL);
    expect(response.body).not.toContain(PHONE);
    expect(response.body).not.toContain('Resumen inventado');
  });

  it('CA-25 recién creada: 1 cambio sin origen', async () => {
    const created = seed(['received']);

    const detail = await detailOf(created.id);

    expect(detail.stage).toBe('received');
    expect(detail.history).toEqual([
      { fromStage: null, toStage: 'received', changedAt: START_AT, reason: null, note: null },
    ]);
  });

  it('CA-26 rechazo manual con motivo y nota (con \\n); job_closed sin nota', async () => {
    const note = 'Primera línea inventada.\nSegunda línea.';
    const created = seed(['received', 'screening']);
    const rejected = await reject(app, created.id, {
      expectedStage: 'screening',
      reason: 'not_a_fit',
      note,
    });
    expect(rejected.statusCode).toBe(200);

    const manual = await detailOf(created.id);

    expect(manual.stage).toBe('rejected');
    expect(manual.history).toHaveLength(3);
    expect(manual.history[2]).toEqual({
      fromStage: 'screening',
      toStage: 'rejected',
      changedAt: NOW,
      reason: 'not_a_fit',
      note,
    });

    await closeJob(app, jobId);
    const other = await createCandidate(app, {
      fullName: 'Otra Candidata Inventada',
      email: 'otra.candidata@example.com',
    });
    const closed = insertApplicationAt(db, {
      jobId,
      candidateId: other.id,
      path: ['received', 'rejected'],
      startAt: START_AT,
      reason: 'job_closed',
    });

    const byClosing = await detailOf(closed.id);

    expect(byClosing.job.status).toBe('closed');
    expect(byClosing.history[1]).toEqual({
      fromStage: 'received',
      toStage: 'rejected',
      changedAt: '2026-10-01T09:01:00.000Z',
      reason: 'job_closed',
      note: null,
    });
  });

  it('EC-20 contratada: 5 cambios en orden', async () => {
    const path: Stage[] = ['received', 'screening', 'interview', 'offer', 'hired'];
    const created = seed(path);

    const detail = await detailOf(created.id);

    expect(detail.stage).toBe('hired');
    expect(detail.history.map((change) => change.toStage)).toEqual(path);
    expect(detail.history.map((change) => change.fromStage)).toEqual([null, ...path.slice(0, 4)]);
    expect(detail.history.map((change) => change.changedAt)).toEqual(
      [...detail.history.map((change) => change.changedAt)].sort(),
    );
  });

  it('CA-27 inexistente → 404 NOT_FOUND sin datos', async () => {
    seed(['received']);

    const response = await getApplication(app, 9999);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'La inscripción no existe.' },
    });
    expect(response.body).not.toContain('Candidata Inventada');
    expect(response.body).not.toContain(EMAIL);
  });
});

describe('GET /api/applications/:id — título de la oferta', () => {
  it('CA-37 job.title sale de getJobSummary (stub con título propio)', async () => {
    await app.close();
    await setUp({ jobStatus: createJobStatusStub({ status: 'closed', title: 'Título del stub' }) });
    const created = seed(['received']);

    const detail = await detailOf(created.id);

    expect(detail.job).toEqual({ id: jobId, title: 'Título del stub', status: 'closed' });
  });
});
