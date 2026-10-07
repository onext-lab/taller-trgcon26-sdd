import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Application, Stage } from '../../src/modules/applications/schemas.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { advance, enroll } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. Contratar cierra el proceso: la retención pasa a ser el día de Madrid del cambio + 6 meses.
const CREATED = '2026-03-01T10:00:00.000Z';
// 23:30 UTC del 14 de marzo es ya el 15 en Madrid (UTC+1): la fecha esperada es 2026-09-15, no 2026-09-14.
const HIRED_AT = '2026-03-14T23:30:00.000Z';
const OFFER_ROUTE: Stage[] = ['received', 'screening', 'interview', 'offer'];

let app: FastifyInstance;
let db: DatabaseSync;
let clock: ReturnType<typeof createTestClock>;
let job: Job;

beforeEach(async () => {
  clock = createTestClock(CREATED);
  ({ app, db } = createTestApp({ now: clock.now }));
  job = await createPublishedJob(app);
});

afterEach(async () => {
  await app.close();
});

function newCandidate(email: string): Promise<Candidate> {
  return createCandidate(app, { fullName: 'Candidata Inventada', email });
}

async function retentionOf(candidateId: number): Promise<string | null> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${candidateId}` });
  return response.json<Candidate>().retentionEndsAt;
}

function countChanges(applicationId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM stage_changes WHERE application_id = ?')
    .get(applicationId);
  return Number(row?.n);
}

/** Inscribe al candidato y lo lleva a `offer` por la API (un minuto entre pasos). */
async function enrollAtOffer(jobId: number, candidateId: number): Promise<Application> {
  const created = (await enroll(app, jobId, candidateId)).json<Application>();
  for (const [index, toStage] of OFFER_ROUTE.slice(1).entries()) {
    clock.advance(60_000);
    const response = await advance(app, created.id, {
      expectedStage: OFFER_ROUTE[index]!,
      toStage,
    });
    expect(response.statusCode).toBe(200);
  }
  return { ...created, stage: 'offer' };
}

function hire(applicationId: number) {
  return advance(app, applicationId, { expectedStage: 'offer', toStage: 'hired' });
}

describe('POST /api/applications/:id/advance — contratar (RN-07)', () => {
  it('CA-04 offer → hired: oferta sigue published, retentionEndsAt = día Madrid + 6 meses', async () => {
    const candidate = await newCandidate('contratada@example.com');
    const created = await enrollAtOffer(job.id, candidate.id);
    expect(await retentionOf(candidate.id)).toBeNull();
    clock.set(HIRED_AT);

    const response = await hire(created.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...created, stage: 'hired', lastChangeAt: HIRED_AT });
    expect(await retentionOf(candidate.id)).toBe('2026-09-15');
    const jobResponse = await app.inject({ method: 'GET', url: `/api/jobs/${job.id}` });
    expect(jobResponse.json<Job>().status).toBe('published');
  });

  it('CA-05 otra abierta en otra oferta no cambia y retención null; segundo hired en la misma oferta', async () => {
    const otherJob = await createPublishedJob(app, { title: 'Otra oferta inventada' });
    const first = await newCandidate('primera@example.com');
    const second = await newCandidate('segunda@example.com');
    const hiredHere = await enrollAtOffer(job.id, first.id);
    const openElsewhere = (await enroll(app, otherJob.id, first.id)).json<Application>();
    const secondHere = await enrollAtOffer(job.id, second.id);
    clock.set(HIRED_AT);

    const hiredFirst = await hire(hiredHere.id);

    expect(hiredFirst.statusCode).toBe(200);
    expect(hiredFirst.json<Application>().stage).toBe('hired');
    expect(await retentionOf(first.id)).toBeNull();
    expect(
      db
        .prepare('SELECT stage, last_change_at AS at FROM applications WHERE id = ?')
        .get(openElsewhere.id),
    ).toEqual({ stage: 'received', at: openElsewhere.lastChangeAt });
    expect(countChanges(openElsewhere.id)).toBe(1);

    const hiredSecond = await hire(secondHere.id);

    expect(hiredSecond.statusCode).toBe(200);
    expect(hiredSecond.json<Application>().stage).toBe('hired');
    expect(await retentionOf(second.id)).toBe('2026-09-15');
    expect(await retentionOf(first.id)).toBeNull();
  });

  it('EC-10 reintento a hired → 200 sin StageChange y retención igual', async () => {
    const candidate = await newCandidate('reintento@example.com');
    const created = await enrollAtOffer(job.id, candidate.id);
    clock.set(HIRED_AT);
    const hired = (await hire(created.id)).json<Application>();
    const retention = await retentionOf(candidate.id);
    const changes = countChanges(created.id);
    clock.set('2026-04-02T08:00:00.000Z');

    for (const expectedStage of ['offer', 'hired'] as const) {
      const response = await advance(app, created.id, { expectedStage, toStage: 'hired' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(hired);
    }

    expect(countChanges(created.id)).toBe(changes);
    expect(await retentionOf(candidate.id)).toBe(retention);
    expect(retention).toBe('2026-09-15');
  });
});
