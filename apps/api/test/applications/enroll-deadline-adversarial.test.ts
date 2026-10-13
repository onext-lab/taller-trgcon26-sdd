import type { FastifyInstance } from 'fastify';
import { Writable } from 'node:stream';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { loggerOptions } from '../../src/logger.ts';
import type { JobStatusPort } from '../../src/modules/applications/ports.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { createJobStatusReader } from '../../src/modules/jobs/job-status.ts';
import { createJobsRepository } from '../../src/modules/jobs/repository.ts';
import {
  createJobStatusSpy,
  createJobStatusStub,
  enroll,
  type JobStatusSpy,
} from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestClock, failWrites } from '../helpers/test-app.ts';

// [adversarial] RF-02 (QUALITY-GATES § 3): categorías 3 Fallo de dependencia, 4 Concurrencia y 6 Seguridad.
// Las ofertas se crean con el reloj días antes del plazo y luego se fija el instante (DD-12). Datos inventados.
const DEADLINE = '2026-10-13';
const PERSON = {
  fullName: 'Valeria Montalbán Ortuño',
  email: 'valeria.montalban@example.com',
  phone: '+34 600 000 088',
};
const PERSONAL = [
  PERSON.fullName,
  'Valeria',
  'Montalbán',
  'valeria.montalban',
  PERSON.email,
  '600 000 088',
];

let app: FastifyInstance;
let db: DatabaseSync;
let lines: string[] = [];

afterEach(async () => {
  await app.close();
});

/** App sobre `:memory:` con el reloj fijado y el logger capturado; `jobStatus` (opcional) recibe la base para armar espías y dobles. */
function setup(jobStatus?: (database: DatabaseSync) => JobStatusPort) {
  lines = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  const clock = createTestClock('2026-10-08T10:00:00Z');
  db = openDatabase(':memory:');
  migrate(db);
  app = buildApp({
    db,
    now: clock.now,
    logger: { ...loggerOptions, stream },
    ...(jobStatus ? { jobStatus: jobStatus(db) } : {}),
  });
  return clock;
}

function count(table: 'applications' | 'stage_changes'): number {
  return Number(db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get()?.total);
}

async function retentionOf(candidateId: number): Promise<string | null> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${candidateId}` });
  return response.json<Candidate>().retentionEndsAt;
}

function newCandidate(): Promise<Candidate> {
  return createCandidate(app, { ...PERSON, consent: true });
}

function expectNoPersonalData(text: string): void {
  for (const personal of PERSONAL) expect(text).not.toContain(personal);
}

describe('RF-02 inscripción fuera de plazo adversarial — fallo de dependencia (categoría 3)', () => {
  it('EC-12 falla el INSERT dentro de plazo → 500 y nada escrito', async () => {
    const clock = setup();
    const job = await createPublishedJob(app, { enrollmentDeadline: DEADLINE });
    const candidate = await newCandidate();
    const retentionBefore = await retentionOf(candidate.id);
    clock.set('2026-10-13T21:59:59Z');
    failWrites(db, 'INSERT', { table: 'applications' });

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
    });
    expect(response.body).not.toContain('fallo simulado');
    expectNoPersonalData(response.body);
    expect(count('applications')).toBe(0);
    expect(count('stage_changes')).toBe(0);
    expect(retentionBefore).not.toBeNull();
    expect(await retentionOf(candidate.id)).toBe(retentionBefore);
  });

  it('getEnrollmentDeadline lanza → 500 sin datos y nada escrito (categoría 3)', async () => {
    setup(() => createJobStatusStub({ status: 'published', failDeadline: true }));
    const job = await createPublishedJob(app, { enrollmentDeadline: DEADLINE });
    const candidate = await newCandidate();

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
    });
    expect(response.body).not.toContain('fecha límite');
    expectNoPersonalData(response.body);
    expect(count('applications')).toBe(0);
    expect(count('stage_changes')).toBe(0);
  });
});

describe('RF-02 inscripción fuera de plazo adversarial — concurrencia (categoría 4)', () => {
  it('EC-13 el plazo se lee dentro de BEGIN IMMEDIATE; recortado a hoy, se inscribe', async () => {
    let spy!: JobStatusSpy;
    const clock = setup((database) => {
      spy = createJobStatusSpy(database, createJobStatusReader(createJobsRepository(database)));
      return spy.port;
    });
    const job = await createPublishedJob(app, { enrollmentDeadline: '2026-10-20' });
    const candidate = await newCandidate();

    // El plazo se recorta a hoy (13/10) y se inscribe en el último segundo del día de Madrid.
    const trim = await app.inject({
      method: 'PATCH',
      url: `/api/jobs/${job.id}`,
      payload: { enrollmentDeadline: DEADLINE },
    });
    expect(trim.statusCode).toBe(200);
    clock.set('2026-10-13T21:59:59Z');
    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(201);
    expect(spy.deadlineInsideTransaction).toEqual([true]);
    expect(count('applications')).toBe(1);
  });
});

describe('RF-02 inscripción fuera de plazo adversarial — seguridad (categoría 6)', () => {
  it('EC-15 el 409 solo lleva code y message con la fecha; nada en el log', async () => {
    const clock = setup();
    const job = await createPublishedJob(app, { enrollmentDeadline: DEADLINE });
    const candidate = await newCandidate();
    clock.set('2026-10-13T22:00:00Z');

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'ENROLLMENT_DEADLINE_PASSED',
        message: 'El plazo de inscripción de esta oferta terminó el 13/10/2026.',
      },
    });
    expect(response.body).not.toContain('details');
    expectNoPersonalData(response.body);
    expectNoPersonalData(lines.join(''));
    expect(count('applications')).toBe(0);
  });
});
