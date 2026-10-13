import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Pipeline } from '../../src/modules/applications/schemas.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { advance, enroll, reject } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  closeJob,
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. La oferta se crea con el reloj antes del plazo y luego se mueve el reloj (DD-12).
const DEADLINE = '2026-10-13';
const CREATED_AT = '2026-10-08T10:00:00Z';

let app: FastifyInstance;
let db: DatabaseSync;
let clock: TestClock;

beforeEach(() => {
  clock = createTestClock(CREATED_AT);
  ({ app, db } = createTestApp({ now: clock.now }));
});

afterEach(async () => {
  await app.close();
});

let sequence = 0;
function newCandidate(): Promise<Candidate> {
  sequence += 1;
  return createCandidate(app, {
    fullName: `Candidata Inventada ${sequence}`,
    email: `candidata.${sequence}@example.com`,
  });
}

function publishedWithDeadline(deadline: string | null = DEADLINE): Promise<Job> {
  return createPublishedJob(app, { title: 'Oferta inventada', enrollmentDeadline: deadline });
}

function getPipeline(jobId: number) {
  return app.inject({ method: 'GET', url: `/api/jobs/${jobId}/applications` });
}

async function jobOf(jobId: number): Promise<Pipeline['job']> {
  return (await getPipeline(jobId)).json<Pipeline>().job;
}

function count(table: 'applications' | 'stage_changes'): number {
  return Number(db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get()?.total);
}

describe('GET /api/jobs/:jobId/applications — plazo de inscripción', () => {
  it('CA-12 published vencida con y sin inscripciones → job con la fecha y enrollmentDeadlinePassed true; items iguales; avanzar y rechazar 200', async () => {
    const withApplications = await publishedWithDeadline();
    const withoutApplications = await publishedWithDeadline();
    const [one, two] = [await newCandidate(), await newCandidate()];
    const first = (await enroll(app, withApplications.id, one.id)).json<{ id: number }>();
    const second = (await enroll(app, withApplications.id, two.id)).json<{ id: number }>();
    const itemsBefore = (await getPipeline(withApplications.id)).json<Pipeline>().items;
    expect(itemsBefore).toHaveLength(2);
    clock.set('2026-10-14T10:00:00Z');

    const full = await getPipeline(withApplications.id);
    const empty = await getPipeline(withoutApplications.id);

    expect(full.statusCode).toBe(200);
    expect(full.json<Pipeline>()).toEqual({
      job: {
        id: withApplications.id,
        status: 'published',
        enrollmentDeadline: DEADLINE,
        enrollmentDeadlinePassed: true,
      },
      items: itemsBefore,
    });
    expect(empty.json()).toEqual({
      job: {
        id: withoutApplications.id,
        status: 'published',
        enrollmentDeadline: DEADLINE,
        enrollmentDeadlinePassed: true,
      },
      items: [],
    });
    // RN-10: el plazo solo afecta a inscribir; las etapas se siguen moviendo.
    const moved = await advance(app, first.id, { expectedStage: 'received', toStage: 'screening' });
    const rejected = await reject(app, second.id, {
      expectedStage: 'received',
      reason: 'not_a_fit',
    });
    expect([moved.statusCode, rejected.statusCode]).toEqual([200, 200]);
  });

  it('CA-06 tras ampliar el plazo, enrollmentDeadlinePassed false', async () => {
    const job = await publishedWithDeadline();
    clock.set('2026-10-14T10:00:00Z');
    expect((await jobOf(job.id)).enrollmentDeadlinePassed).toBe(true);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/jobs/${job.id}`,
      payload: { enrollmentDeadline: '2026-10-20' },
    });

    expect(patch.statusCode).toBe(200);
    expect(await jobOf(job.id)).toEqual({
      id: job.id,
      status: 'published',
      enrollmentDeadline: '2026-10-20',
      enrollmentDeadlinePassed: false,
    });
  });

  it('EC-25 plazo hoy → false; ayer → true, también con items: []', async () => {
    const job = await publishedWithDeadline();

    clock.set('2026-10-13T10:00:00Z');
    const today = await getPipeline(job.id);
    clock.set('2026-10-14T10:00:00Z');
    const yesterday = await getPipeline(job.id);

    expect(today.json<Pipeline>().job.enrollmentDeadlinePassed).toBe(false);
    expect(yesterday.json<Pipeline>()).toMatchObject({
      job: { enrollmentDeadline: DEADLINE, enrollmentDeadlinePassed: true },
      items: [],
    });
  });

  it('EC-25 sin plazo → enrollmentDeadline null y enrollmentDeadlinePassed false, aunque pase el tiempo', async () => {
    const job = await publishedWithDeadline(null);
    clock.set('2030-01-01T10:00:00Z');

    expect(await jobOf(job.id)).toEqual({
      id: job.id,
      status: 'published',
      enrollmentDeadline: null,
      enrollmentDeadlinePassed: false,
    });
  });

  it('EC-27 pipeline a las 23:59 false, inscribir a las 00:00 → 409, pipeline → true', async () => {
    const job = await publishedWithDeadline();
    const candidate = await newCandidate();

    clock.set('2026-10-13T21:59:00Z'); // 23:59 en Madrid (CEST, UTC+2)
    expect((await jobOf(job.id)).enrollmentDeadlinePassed).toBe(false);
    clock.set('2026-10-13T22:00:00Z'); // 00:00 del 14 en Madrid
    const late = await enroll(app, job.id, candidate.id);

    expect(late.statusCode).toBe(409);
    expect(late.json()).toMatchObject({ error: { code: 'ENROLLMENT_DEADLINE_PASSED' } });
    expect((await jobOf(job.id)).enrollmentDeadlinePassed).toBe(true);
    expect(count('applications')).toBe(0);
  });

  it('EC-28 closed con plazo vencido → status closed y enrollmentDeadlinePassed true; draft también', async () => {
    const closed = await closeJob(app, (await publishedWithDeadline()).id);
    const draft = await createJob(app, {
      title: 'Borrador inventado',
      enrollmentDeadline: DEADLINE,
    });
    clock.set('2026-10-14T10:00:00Z');

    expect(await jobOf(closed.id)).toEqual({
      id: closed.id,
      status: 'closed',
      enrollmentDeadline: DEADLINE,
      enrollmentDeadlinePassed: true,
    });
    expect(await jobOf(draft.id)).toEqual({
      id: draft.id,
      status: 'draft',
      enrollmentDeadline: DEADLINE,
      enrollmentDeadlinePassed: true,
    });
  });

  it('EC-30 dos lecturas iguales, sin escrituras', async () => {
    const job = await publishedWithDeadline();
    await enroll(app, job.id, (await newCandidate()).id);
    clock.set('2026-10-14T10:00:00Z');
    const stageChanges = count('stage_changes');

    const first = await getPipeline(job.id);
    const second = await getPipeline(job.id);

    expect(first.statusCode).toBe(200);
    expect(second.body).toBe(first.body);
    expect(count('stage_changes')).toBe(stageChanges);
  });
});
