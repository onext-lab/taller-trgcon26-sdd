import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertApplicationWithHistory, type SeedStep } from '../../src/db/seed-applications.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { Pipeline } from '../../src/modules/applications/schemas.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  closeJob,
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Los instantes se escriben a mano: el pipeline solo lee lo que hay en la base.
const NOW = '2026-10-07T10:00:00.000Z';
const ITEM_KEYS = ['candidateName', 'id', 'lastChangeAt', 'rejectionReason', 'stage'];
const NOT_FOUND_MESSAGE = 'La oferta no existe.';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

let sequence = 0;
function newCandidate(extra: Record<string, unknown> = {}): Promise<Candidate> {
  sequence += 1;
  return createCandidate(app, {
    fullName: `Candidata Inventada ${sequence}`,
    email: `candidata.${sequence}@example.com`,
    ...extra,
  });
}

function enrollDirect(jobId: number, candidateId: number, steps: readonly SeedStep[]) {
  return insertApplicationWithHistory(createApplicationsRepository(db), {
    candidateId,
    jobId,
    steps,
  });
}

function at(minute: number): string {
  return `2026-09-01T09:${String(minute).padStart(2, '0')}:00.000Z`;
}

function getPipeline(jobId: number | string, query = '') {
  return app.inject({ method: 'GET', url: `/api/jobs/${jobId}/applications${query}` });
}

describe('GET /api/jobs/:jobId/applications — pipeline', () => {
  it('CA-12 orden last_change desc + id desc, motivo solo en rejected, sin paginar', async () => {
    const job = await createPublishedJob(app);
    const [first, second, third, fourth] = [
      await newCandidate(),
      await newCandidate(),
      await newCandidate(),
      await newCandidate(),
    ];
    const received = enrollDirect(job.id, first.id, [{ stage: 'received', at: at(1) }]);
    const interview = enrollDirect(job.id, second.id, [
      { stage: 'received', at: at(1) },
      { stage: 'screening', at: at(2) },
      { stage: 'interview', at: at(30) },
    ]);
    const rejected = enrollDirect(job.id, third.id, [
      { stage: 'received', at: at(1) },
      { stage: 'rejected', at: at(45), reason: 'not_a_fit' },
    ]);
    const hired = enrollDirect(job.id, fourth.id, [
      { stage: 'received', at: at(1) },
      { stage: 'screening', at: at(2) },
      { stage: 'interview', at: at(3) },
      { stage: 'offer', at: at(4) },
      { stage: 'hired', at: at(10) },
    ]);

    const response = await getPipeline(job.id);

    expect(response.statusCode).toBe(200);
    const body = response.json<Pipeline>();
    expect(body.job).toEqual({ id: job.id, status: 'published' });
    expect(
      body.items.map(({ id, stage, lastChangeAt, rejectionReason }) => [
        id,
        stage,
        lastChangeAt,
        rejectionReason,
      ]),
    ).toEqual([
      [rejected.id, 'rejected', at(45), 'not_a_fit'],
      [interview.id, 'interview', at(30), null],
      [hired.id, 'hired', at(10), null],
      [received.id, 'received', at(1), null],
    ]);
    expect(body.items.map((item) => item.candidateName)).toEqual([
      third.fullName,
      second.fullName,
      fourth.fullName,
      first.fullName,
    ]);
  });

  it('CA-13 cada item con exactamente 5 claves; 0 email, phone ni note', async () => {
    const job = await createPublishedJob(app);
    const withPhone = await newCandidate({ phone: '+34 600 111 222' });
    const other = await newCandidate({ phone: '+34 600 333 444' });
    enrollDirect(job.id, withPhone.id, [{ stage: 'received', at: at(1) }]);
    enrollDirect(job.id, other.id, [
      { stage: 'received', at: at(1) },
      { stage: 'rejected', at: at(2), reason: 'other', note: 'Nota interna inventada del rechazo' },
    ]);

    const response = await getPipeline(job.id);

    expect(response.statusCode).toBe(200);
    const body = response.json<Pipeline>();
    expect(body.items).toHaveLength(2);
    for (const item of body.items) expect(Object.keys(item).sort()).toEqual(ITEM_KEYS);
    expect(Object.keys(body).sort()).toEqual(['items', 'job']);
    expect(response.body).not.toContain('email');
    expect(response.body).not.toContain('phone');
    expect(response.body).not.toContain('note');
    for (const forbidden of [withPhone.email, other.email, '+34 600', 'Nota interna']) {
      expect(response.body).not.toContain(forbidden);
    }
  });

  it('CA-14 publicada sin inscripciones → 200 con items []', async () => {
    const job = await createPublishedJob(app);

    const response = await getPipeline(job.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ job: { id: job.id, status: 'published' }, items: [] });
  });

  it('CA-15 inexistente → 404 «La oferta no existe.» sin datos', async () => {
    const job = await createPublishedJob(app);
    enrollDirect(job.id, (await newCandidate()).id, [{ stage: 'received', at: at(1) }]);

    const response = await getPipeline(job.id + 1000);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'NOT_FOUND', message: NOT_FOUND_MESSAGE } });
    expect(response.body).not.toContain('Candidata Inventada');
  });

  it('EC-27 0, 1 y 200 inscripciones sin paginar; empate de fecha resuelto por ID desc', async () => {
    const job = await createPublishedJob(app);
    expect((await getPipeline(job.id)).json<Pipeline>().items).toHaveLength(0);

    const only = enrollDirect(job.id, (await newCandidate()).id, [
      { stage: 'received', at: at(1) },
    ]);
    expect((await getPipeline(job.id)).json<Pipeline>().items.map((item) => item.id)).toEqual([
      only.id,
    ]);

    const ids = [only.id];
    for (let index = 1; index < 200; index += 1) {
      const candidate = await newCandidate();
      ids.push(enrollDirect(job.id, candidate.id, [{ stage: 'received', at: at(1) }]).id);
    }

    const response = await getPipeline(job.id);

    expect(response.statusCode).toBe(200);
    // Las 200 comparten `last_change_at`: el orden lo decide el ID descendente.
    expect(response.json<Pipeline>().items.map((item) => item.id)).toEqual([...ids].reverse());
  });

  it('EC-28 draft → 200 con status draft e items []', async () => {
    const draft = await createJob(app, { title: 'Borrador inventado' });

    const response = await getPipeline(draft.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ job: { id: draft.id, status: 'draft' }, items: [] });
  });

  it('EC-28 closed con inscripciones → 200 con sus items', async () => {
    const job = await createPublishedJob(app);
    await closeJob(app, job.id);
    const candidate = await newCandidate();
    const rejected = enrollDirect(job.id, candidate.id, [
      { stage: 'received', at: at(1) },
      { stage: 'rejected', at: at(5), reason: 'job_closed' },
    ]);

    const response = await getPipeline(job.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      job: { id: job.id, status: 'closed' },
      items: [
        {
          id: rejected.id,
          candidateName: candidate.fullName,
          stage: 'rejected',
          lastChangeAt: at(5),
          rejectionReason: 'job_closed',
        },
      ],
    });
  });
});
