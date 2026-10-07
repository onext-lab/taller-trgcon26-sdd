import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTransaction } from '../../src/db/transaction.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { Stage } from '../../src/modules/applications/schemas.ts';
import { createApplicationsService } from '../../src/modules/applications/service.ts';
import { createJobStatusStub, insertApplicationAt } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// TASK-01 (EC-01, EC-07, DD-04): las dos operaciones de `inscripciones` para el cierre de oferta, con llamadas directas
// al servicio sobre la misma base de `createTestApp`. Datos inventados.
const START_AT = '2026-10-01T09:00:00.000Z';
const CLOSED_AT = '2026-10-06T22:30:00.000Z';

let app: FastifyInstance;
let db: DatabaseSync;
let jobId: number;
let retentionCalls: number[];
let service: ReturnType<typeof createApplicationsService>;

beforeEach(async () => {
  ({ app, db } = createTestApp());
  jobId = (await createPublishedJob(app)).id;
  retentionCalls = [];
  service = createApplicationsService({
    repository: createApplicationsRepository(db),
    now: createTestClock(CLOSED_AT).now,
    transaction: (fn) => withTransaction(db, fn),
    jobStatus: createJobStatusStub(),
    candidates: { exists: () => true, findNames: () => new Map() },
    recalculateRetention: (candidateId) => {
      retentionCalls.push(candidateId);
    },
  });
});

afterEach(async () => {
  await app.close();
});

let candidateCount = 0;

/** Candidato nuevo por la API (emails y teléfonos inventados y distintos) con la inscripción ya en `path`. */
async function enrollAt(targetJobId: number, ...path: Stage[]) {
  candidateCount += 1;
  const candidate = await createCandidate(app, {
    fullName: `Candidata Inventada ${candidateCount}`,
    email: `candidata.cierre.${candidateCount}@example.com`,
    phone: `+34 600 000 ${String(candidateCount).padStart(3, '0')}`,
    consent: false,
  });
  const application = insertApplicationAt(db, {
    jobId: targetJobId,
    candidateId: candidate.id,
    path,
    startAt: START_AT,
  });
  return { candidate, application };
}

interface StoredApplication {
  id: number;
  stage: string;
  last_change_at: string;
}

function storedApplications(): StoredApplication[] {
  return db
    .prepare('SELECT id, stage, last_change_at FROM applications ORDER BY id')
    .all() as unknown as StoredApplication[];
}

function countStageChanges(): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM stage_changes').get();
  return Number(row?.total);
}

function historyOf(applicationId: number) {
  return db
    .prepare(
      'SELECT from_stage, to_stage, changed_at, reason, note FROM stage_changes WHERE application_id = ? ORDER BY id',
    )
    .all(applicationId);
}

describe('applications — operaciones del cierre de oferta (HU-06 TASK-01)', () => {
  it('EC-01 closedAt no ISO → error y nada escrito; jobId sin inscripciones o inexistente → 0', async () => {
    const first = await enrollAt(jobId, 'received');
    const second = await enrollAt(jobId, 'received', 'screening');
    const before = storedApplications();
    const changesBefore = countStageChanges();

    expect(() =>
      service.rejectActiveApplications({ jobId, closedAt: '2026-10-06 22:30' }),
    ).toThrow();

    expect(storedApplications()).toEqual(before);
    expect(countStageChanges()).toBe(changesBefore);
    expect(retentionCalls).toEqual([]);
    expect(before.map((row) => row.id)).toEqual([first.application.id, second.application.id]);

    const emptyJob = await createPublishedJob(app, { title: 'Oferta sin inscripciones' });
    for (const target of [emptyJob.id, 999_999]) {
      expect(service.rejectActiveApplications({ jobId: target, closedAt: CLOSED_AT })).toBe(0);
    }
    expect(countStageChanges()).toBe(changesBefore);
    expect(retentionCalls).toEqual([]);
  });

  it('EC-07 segunda llamada → 0 sin StageChange ni recálculo', async () => {
    const received = await enrollAt(jobId, 'received');
    const offer = await enrollAt(jobId, 'received', 'screening', 'interview', 'offer');
    const hired = await enrollAt(jobId, 'received', 'screening', 'interview', 'offer', 'hired');
    const hiredBefore = storedApplications().find((row) => row.id === hired.application.id);

    expect(service.countActiveApplications(jobId)).toBe(2);
    expect(service.rejectActiveApplications({ jobId, closedAt: CLOSED_AT })).toBe(2);

    const stored = storedApplications();
    for (const [application, fromStage] of [
      [received.application, 'received'],
      [offer.application, 'offer'],
    ] as const) {
      expect(stored.find((row) => row.id === application.id)).toMatchObject({
        stage: 'rejected',
        last_change_at: CLOSED_AT,
      });
      expect(historyOf(application.id).at(-1)).toEqual({
        from_stage: fromStage,
        to_stage: 'rejected',
        changed_at: CLOSED_AT,
        reason: 'job_closed',
        note: null,
      });
    }
    expect(retentionCalls).toEqual([received.candidate.id, offer.candidate.id]);
    expect(service.countActiveApplications(jobId)).toBe(0);

    const changesAfterFirst = countStageChanges();
    expect(service.rejectActiveApplications({ jobId, closedAt: CLOSED_AT })).toBe(0);

    expect(countStageChanges()).toBe(changesAfterFirst);
    expect(retentionCalls).toHaveLength(2);
    expect(stored.find((row) => row.id === hired.application.id)).toEqual(hiredBefore);
  });

  it('DD-04 dentro de una transacción se une: ROLLBACK exterior lo deshace', async () => {
    await enrollAt(jobId, 'received');
    await enrollAt(jobId, 'received', 'screening');
    const before = storedApplications();
    const changesBefore = countStageChanges();

    expect(() =>
      withTransaction(db, () => {
        expect(service.rejectActiveApplications({ jobId, closedAt: CLOSED_AT })).toBe(2);
        throw new Error('fallo exterior');
      }),
    ).toThrow('fallo exterior');

    expect(storedApplications()).toEqual(before);
    expect(countStageChanges()).toBe(changesBefore);
    expect(service.countActiveApplications(jobId)).toBe(2);
  });
});
