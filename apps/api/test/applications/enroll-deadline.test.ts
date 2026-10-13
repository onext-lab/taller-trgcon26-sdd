import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { addCalendarDays } from '../../src/calendar.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { createJobStatusReader } from '../../src/modules/jobs/job-status.ts';
import { createJobsRepository } from '../../src/modules/jobs/repository.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { createJobStatusSpy, enroll } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  closeJob,
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
  type TestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Las ofertas se crean con el reloj días antes del plazo y luego se mueve el reloj (DD-12).
const DEADLINE = '2026-10-13';
const PASSED = {
  error: {
    code: 'ENROLLMENT_DEADLINE_PASSED',
    message: 'El plazo de inscripción de esta oferta terminó el 13/10/2026.',
  },
};
const NOT_PUBLISHED = {
  error: {
    code: 'INVALID_TRANSITION',
    message: 'La oferta no está publicada: no admite inscripciones.',
  },
};

let app: FastifyInstance;
let db: DatabaseSync;
let clock: TestClock;

beforeEach(() => {
  clock = createTestClock('2026-10-01T10:00:00Z');
  ({ app, db } = createTestApp({ now: clock.now }));
});

afterEach(async () => {
  await app.close();
});

let sequence = 0;
async function newCandidate(consent = false): Promise<Candidate> {
  sequence += 1;
  return createCandidate(app, {
    fullName: `Candidata Inventada ${sequence}`,
    email: `candidata.${sequence}@example.com`,
    consent,
  });
}

/** Mueve el reloj cinco días antes del plazo, crea la oferta (borrador o publicada) y la devuelve. */
async function jobWithDeadline(deadline: string | null, publish = true): Promise<Job> {
  clock.set(`${addCalendarDays(deadline ?? DEADLINE, -5)}T10:00:00Z`);
  const body = { title: `Oferta inventada ${sequence}`, enrollmentDeadline: deadline };
  if (publish) return createPublishedJob(app, body);
  return createJob(app, body);
}

function count(table: 'applications' | 'stage_changes'): number {
  return Number(db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get()?.total);
}

async function retentionOf(candidateId: number): Promise<string | null> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${candidateId}` });
  return response.json<Candidate>().retentionEndsAt;
}

function patchJob(id: number, payload: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: `/api/jobs/${id}`, payload });
}

describe('POST /api/applications — plazo de inscripción', () => {
  it('CA-09 plazo hoy a las 23:59:59 de Madrid y oferta sin plazo → 201', async () => {
    const withDeadline = await jobWithDeadline(DEADLINE);
    const withoutDeadline = await jobWithDeadline(null);
    const [one, two] = [await newCandidate(), await newCandidate()];

    clock.set('2026-10-13T21:59:59Z');
    const last = await enroll(app, withDeadline.id, one.id);
    const open = await enroll(app, withoutDeadline.id, two.id);

    expect([last.statusCode, open.statusCode]).toEqual([201, 201]);
    expect(last.json()).toMatchObject({ stage: 'received', createdAt: '2026-10-13T21:59:59.000Z' });
    expect(count('applications')).toBe(2);
  });

  it('CA-10 00:00:00 del 14 → 409 ENROLLMENT_DEADLINE_PASSED dos veces; 0 inscripciones, 0 StageChange, retención igual', async () => {
    const job = await jobWithDeadline(DEADLINE);
    const candidate = await newCandidate(true);
    const retentionBefore = await retentionOf(candidate.id);
    clock.set('2026-10-13T22:00:00Z');

    const first = await enroll(app, job.id, candidate.id);
    const again = await enroll(app, job.id, candidate.id);

    for (const response of [first, again]) {
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual(PASSED);
      expect(response.body).not.toContain('details');
      expect(response.body).not.toContain(candidate.fullName);
      expect(response.body).not.toContain(candidate.email);
    }
    expect(count('applications')).toBe(0);
    expect(count('stage_changes')).toBe(0);
    expect(retentionBefore).not.toBeNull();
    expect(await retentionOf(candidate.id)).toBe(retentionBefore);
  });

  it('CA-11 vencida con el candidato ya inscrito → ENROLLMENT_DEADLINE_PASSED (no DUPLICATE); closed y draft vencidas → INVALID_TRANSITION', async () => {
    const published = await jobWithDeadline(DEADLINE);
    const candidate = await newCandidate();
    clock.set('2026-10-13T10:00:00Z');
    expect((await enroll(app, published.id, candidate.id)).statusCode).toBe(201);
    const closed = await jobWithDeadline(DEADLINE);
    await closeJob(app, closed.id);
    const draft = await jobWithDeadline(DEADLINE, false);
    clock.set('2026-10-14T10:00:00Z');

    const again = await enroll(app, published.id, candidate.id);
    const onClosed = await enroll(app, closed.id, candidate.id);
    const onDraft = await enroll(app, draft.id, candidate.id);

    expect([again.statusCode, again.json()]).toEqual([409, PASSED]);
    expect([onClosed.statusCode, onClosed.json()]).toEqual([409, NOT_PUBLISHED]);
    expect([onDraft.statusCode, onDraft.json()]).toEqual([409, NOT_PUBLISHED]);
    expect(count('applications')).toBe(1);
  });

  it('CA-06 ampliar el plazo a hoy o quitarlo → sigue published e inscribir da 201', async () => {
    const extended = await jobWithDeadline(DEADLINE);
    const removed = await jobWithDeadline(DEADLINE);
    const [one, two] = [await newCandidate(), await newCandidate()];
    clock.set('2026-10-14T10:00:00Z');
    expect((await enroll(app, extended.id, one.id)).statusCode).toBe(409);

    const extend = await patchJob(extended.id, { enrollmentDeadline: '2026-10-14' });
    const remove = await patchJob(removed.id, { enrollmentDeadline: null });

    expect([extend.statusCode, remove.statusCode]).toEqual([200, 200]);
    expect(extend.json<Job>()).toMatchObject({
      status: 'published',
      enrollmentDeadline: '2026-10-14',
    });
    expect(remove.json<Job>()).toMatchObject({ status: 'published', enrollmentDeadline: null });
    expect((await enroll(app, extended.id, one.id)).statusCode).toBe(201);
    expect((await enroll(app, removed.id, two.id)).statusCode).toBe(201);
  });

  // [etiqueta, esperado, plazo, reloj UTC]: la frontera es la medianoche de Madrid, también en los cambios de hora.
  const BOUNDARIES: [string, number, string, string][] = [
    ['2026-10-13 con reloj 21:59:59Z', 201, '2026-10-13', '2026-10-13T21:59:59Z'],
    ['2026-10-13 con reloj 22:00:00Z', 409, '2026-10-13', '2026-10-13T22:00:00Z'],
    ['2026-10-13 con reloj 23:30:00Z (UTC aún 13)', 409, '2026-10-13', '2026-10-13T23:30:00Z'],
    ['2026-03-29 con reloj 21:59:59Z', 201, '2026-03-29', '2026-03-29T21:59:59Z'],
    ['2026-03-29 con reloj 22:00:00Z', 409, '2026-03-29', '2026-03-29T22:00:00Z'],
    ['2026-03-28 con reloj 22:59:59Z', 201, '2026-03-28', '2026-03-28T22:59:59Z'],
    ['2026-03-28 con reloj 23:00:00Z', 409, '2026-03-28', '2026-03-28T23:00:00Z'],
    ['2026-10-25 con reloj 22:59:59Z', 201, '2026-10-25', '2026-10-25T22:59:59Z'],
    ['2026-10-25 con reloj 23:00:00Z', 409, '2026-10-25', '2026-10-25T23:00:00Z'],
    ['2026-10-24 con reloj 21:59:59Z', 201, '2026-10-24', '2026-10-24T21:59:59Z'],
    ['2026-10-24 con reloj 22:00:00Z', 409, '2026-10-24', '2026-10-24T22:00:00Z'],
  ];

  it.each(BOUNDARIES)('RNF-01 frontera %s → %i', async (_label, expected, deadline, instant) => {
    const job = await jobWithDeadline(deadline);
    const candidate = await newCandidate();
    clock.set(instant);

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(expected);
    expect(count('applications')).toBe(expected === 201 ? 1 : 0);
  });
});

describe('POST /api/applications — plazo leído dentro de la transacción (DEC-08)', () => {
  it('EC-16 la fecha límite se lee con db.isTransaction === true, también en el 409', async () => {
    await app.close();
    db = openDatabase(':memory:');
    migrate(db);
    const reader = createJobStatusReader(createJobsRepository(db));
    const spy = createJobStatusSpy(db, reader);
    app = buildApp({ db, now: clock.now, jobStatus: spy.port });
    const job = await jobWithDeadline(DEADLINE);
    const candidate = await newCandidate();

    clock.set('2026-10-13T10:00:00Z');
    const inTime = await enroll(app, job.id, candidate.id);
    clock.set('2026-10-14T10:00:00Z');
    const late = await enroll(app, job.id, candidate.id);

    expect([inTime.statusCode, late.statusCode]).toEqual([201, 409]);
    expect(spy.deadlineInsideTransaction).toEqual([true, true]);
  });
});
