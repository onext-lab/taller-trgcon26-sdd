import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertApplicationWithHistory } from '../../src/db/seed-applications.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { enroll } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  closeJob,
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Reloj fijo: la inscripción y su historial llevan este instante.
const NOW = '2026-10-07T10:00:00.000Z';
const SIX_KEYS = ['candidateId', 'createdAt', 'id', 'jobId', 'lastChangeAt', 'stage'];

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

let sequence = 0;
async function newCandidate(): Promise<Candidate> {
  sequence += 1;
  return createCandidate(app, {
    fullName: `Candidata Inventada ${sequence}`,
    email: `candidata.${sequence}@example.com`,
    phone: `+34 600 000 0${String(sequence).padStart(2, '0')}`,
  });
}

function count(table: 'applications' | 'stage_changes'): number {
  return Number(db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get()?.total);
}

async function retentionOf(candidateId: number): Promise<string | null> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${candidateId}` });
  return response.json<Candidate>().retentionEndsAt;
}

function expectNoPersonalData(body: string, candidate: Candidate): void {
  expect(body).not.toContain(candidate.fullName);
  expect(body).not.toContain(candidate.email);
  expect(body).not.toContain(candidate.phone ?? 'sin-telefono');
}

describe('POST /api/applications — inscribir', () => {
  it('CA-01 inscribir → 201 received con exactamente 6 claves, StageChange NULL→received y retención null', async () => {
    const job = await createPublishedJob(app);
    const candidate = await newCandidate();
    expect(await retentionOf(candidate.id)).toBe('2027-04-07');

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(201);
    const body = response.json<Record<string, unknown>>();
    expect(Object.keys(body).sort()).toEqual(SIX_KEYS);
    expect(body).toEqual({
      id: 1,
      jobId: job.id,
      candidateId: candidate.id,
      stage: 'received',
      createdAt: NOW,
      lastChangeAt: NOW,
    });
    expectNoPersonalData(response.body, candidate);
    const changes = db.prepare('SELECT * FROM stage_changes').all();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      application_id: 1,
      from_stage: null,
      to_stage: 'received',
      changed_at: NOW,
      reason: null,
      note: null,
    });
    expect(await retentionOf(candidate.id)).toBeNull();
  });

  it('CA-04 draft → 409 INVALID_TRANSITION, nada creado, retención igual', async () => {
    const draft = await createJob(app, { title: 'Borrador inventado' });
    const candidate = await newCandidate();
    const before = await retentionOf(candidate.id);

    const response = await enroll(app, draft.id, candidate.id);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_TRANSITION',
        message: 'La oferta no está publicada: no admite inscripciones.',
      },
    });
    expect(count('applications')).toBe(0);
    expect(count('stage_changes')).toBe(0);
    expect(await retentionOf(candidate.id)).toBe(before);
  });

  it('CA-05 closed → 409 con el mismo mensaje que draft', async () => {
    const job = await createPublishedJob(app);
    await closeJob(app, job.id);
    const candidate = await newCandidate();

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_TRANSITION',
        message: 'La oferta no está publicada: no admite inscripciones.',
      },
    });
    expect(count('applications')).toBe(0);
  });

  it('CA-06 repetir en received → 409 DUPLICATE con existingId, retención igual', async () => {
    const job = await createPublishedJob(app);
    const candidate = await newCandidate();
    const first = await enroll(app, job.id, candidate.id);
    const before = await retentionOf(candidate.id);

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(409);
    const message = 'Este candidato ya está inscrito en la oferta.';
    expect(response.json()).toEqual({
      error: {
        code: 'DUPLICATE',
        message,
        details: [{ field: 'candidateId', message, existingId: first.json<{ id: number }>().id }],
      },
    });
    expectNoPersonalData(response.body, candidate);
    expect(count('applications')).toBe(1);
    expect(count('stage_changes')).toBe(1);
    expect(await retentionOf(candidate.id)).toBe(before);
  });

  it('CA-06 / EC-04 repetir tras un rechazo → 409 DUPLICATE con el ID de la rechazada, retención igual', async () => {
    const job = await createPublishedJob(app);
    const candidate = await newCandidate();
    const rejected = insertApplicationWithHistory(createApplicationsRepository(db), {
      candidateId: candidate.id,
      jobId: job.id,
      steps: [
        { stage: 'received', at: '2026-09-01T09:00:00.000Z' },
        { stage: 'rejected', at: '2026-09-02T09:00:00.000Z', reason: 'not_a_fit' },
      ],
    });
    const before = await retentionOf(candidate.id);

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: { code: string; details: unknown } }>().error).toMatchObject({
      code: 'DUPLICATE',
      details: [{ field: 'candidateId', existingId: rejected.id }],
    });
    expect(count('applications')).toBe(1);
    expect(count('stage_changes')).toBe(2);
    expect(await retentionOf(candidate.id)).toBe(before);
  });

  it('CA-09 oferta y candidato inexistentes → 404 con su mensaje, sin datos', async () => {
    const job = await createPublishedJob(app);
    const candidate = await newCandidate();

    const noJob = await enroll(app, job.id + 1000, candidate.id);
    const noCandidate = await enroll(app, job.id, candidate.id + 1000);
    const neither = await enroll(app, job.id + 1000, candidate.id + 1000);

    expect(noJob.statusCode).toBe(404);
    expect(noJob.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'La oferta no existe.' } });
    expect(noCandidate.statusCode).toBe(404);
    expect(noCandidate.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'El candidato no existe.' },
    });
    // Con los dos inexistentes gana la oferta (orden del diseño).
    expect(neither.statusCode).toBe(404);
    expect(neither.json<{ error: { message: string } }>().error.message).toBe(
      'La oferta no existe.',
    );
    expect(count('applications')).toBe(0);
    expect(count('stage_changes')).toBe(0);
  });

  it('EC-11 reintento de una inscripción creada → 409 con el ID; 1 StageChange; retención igual', async () => {
    const job = await createPublishedJob(app);
    const candidate = await newCandidate();
    const created = (await enroll(app, job.id, candidate.id)).json<{ id: number }>();
    const retention = await retentionOf(candidate.id);

    const retry = await enroll(app, job.id, candidate.id);

    expect(retry.statusCode).toBe(409);
    expect(retry.json<{ error: { details: unknown } }>().error.details).toEqual([
      expect.objectContaining({ existingId: created.id }),
    ]);
    expect(count('applications')).toBe(1);
    expect(count('stage_changes')).toBe(1);
    expect(await retentionOf(candidate.id)).toBe(retention);
  });

  it('EC-17 draft 409, published 201, closed 409, inexistente y borrador borrado 404', async () => {
    const candidate = await newCandidate();
    const draft = await createJob(app, { title: 'Borrador inventado' });
    const published = await createPublishedJob(app);
    const closed = await createPublishedJob(app, { title: 'Cerrada inventada' });
    await closeJob(app, closed.id);
    const deleted = await createJob(app, { title: 'Borrada inventada' });
    await app.inject({ method: 'DELETE', url: `/api/jobs/${deleted.id}` });

    const statuses = await Promise.all(
      [draft.id, published.id, closed.id, deleted.id, deleted.id + 1000].map(
        async (jobId) => (await enroll(app, jobId, candidate.id)).statusCode,
      ),
    );

    expect(statuses).toEqual([409, 201, 409, 404, 404]);
    expect(count('applications')).toBe(1);
  });
});
