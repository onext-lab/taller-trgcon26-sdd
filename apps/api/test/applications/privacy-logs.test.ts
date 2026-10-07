import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { Writable } from 'node:stream';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { loggerOptions } from '../../src/logger.ts';
import type { JobStatusPort } from '../../src/modules/applications/ports.ts';
import type { CandidateProcessesPort } from '../../src/modules/candidates/processes-port.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { enroll } from '../helpers/applications.ts';
import { createCandidate, createProcessesStub } from '../helpers/candidates.ts';
import { createPublishedJob, createTestClock, failWrites } from '../helpers/test-app.ts';

// TASK-08 [adversarial] (RNF-03, EC-09, EC-24): con el logger de la app capturado, ni los cuerpos ni los logs de los
// errores de inscribir llevan datos personales. Datos inventados.
const NOW = '2026-10-06T09:00:00.000Z';
const PERSON = {
  fullName: 'Marta Quintanilla Ibarra',
  email: 'marta.quintanilla@example.com',
  phone: '+34 600 000 077',
};
const NOTE = 'Nota inventada reservada del proceso previo.';
// Texto que no puede salir en ningún log ni cuerpo de error.
const PERSONAL = [
  PERSON.fullName,
  'Marta',
  'Quintanilla',
  'marta.quintanilla',
  PERSON.email,
  '600 000 077',
  'Nota inventada reservada',
];

let app: FastifyInstance;
let db: DatabaseSync;
let lines: string[];
let failStatus = false;
let failProcesses = false;

/** Lee el estado real de la oferta; lanza un error fijo cuando `failStatus` está activo (EC-18). */
const statusPort: JobStatusPort = {
  getJobStatus(jobId) {
    if (failStatus) throw new Error('fallo simulado del puerto de estado');
    const row = db.prepare('SELECT status FROM job_openings WHERE id = ?').get(jobId);
    return row ? (row.status as 'draft' | 'published' | 'closed') : null;
  },
  getJobSummary(jobId) {
    if (failStatus) throw new Error('fallo simulado del puerto de estado');
    const row = db.prepare('SELECT status, title FROM job_openings WHERE id = ?').get(jobId);
    return row
      ? { status: row.status as 'draft' | 'published' | 'closed', title: String(row.title) }
      : null;
  },
};

/** Funciona en el alta del candidato y falla después, cuando `failProcesses` está activo (EC-22). */
const processesPort: CandidateProcessesPort = {
  getProcesses(id) {
    return createProcessesStub({ fail: failProcesses }).getProcesses(id);
  },
};

beforeEach(() => {
  lines = [];
  failStatus = false;
  failProcesses = false;
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  db = openDatabase(':memory:');
  migrate(db);
  app = buildApp({
    db,
    now: createTestClock(NOW).now,
    logger: { ...loggerOptions, stream },
    jobStatus: statusPort,
    candidateProcesses: processesPort,
  });
});

afterEach(async () => {
  await app.close();
});

function logs(): string {
  return lines.join('');
}

function expectNoPersonalData(text: string): void {
  for (const personal of PERSONAL) expect(text).not.toContain(personal);
}

function expectErrorBody(response: LightMyRequestResponse, status: number, code: string): void {
  expect(response.statusCode).toBe(status);
  expect(response.json<{ error: { code: string } }>().error.code).toBe(code);
  expectNoPersonalData(response.body);
  expect(response.body).not.toContain('SQLITE');
  expect(response.body).not.toContain('stack');
}

function insertRejectedWithNote(candidateId: number, jobId: number): number {
  const application = db
    .prepare(
      `INSERT INTO applications (candidate_id, job_id, stage, created_at, last_change_at)
       VALUES (?, ?, 'rejected', ?, ?) RETURNING id`,
    )
    .get(candidateId, jobId, NOW, NOW);
  const id = Number(application?.id);
  const history = db.prepare(
    `INSERT INTO stage_changes (application_id, from_stage, to_stage, changed_at, reason, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  history.run(id, null, 'received', NOW, null, null);
  history.run(id, 'received', 'rejected', NOW, 'not_a_fit', NOTE);
  return id;
}

/** Candidato con nombre, email y teléfono únicos y una inscripción `rejected` con nota, en una oferta publicada. */
async function seed(): Promise<{ candidate: Candidate; rejectedId: number; jobId: number }> {
  const job = await createPublishedJob(app);
  const candidate = await createCandidate(app, { ...PERSON, consent: false });
  return { candidate, rejectedId: insertRejectedWithNote(candidate.id, job.id), jobId: job.id };
}

function errorEntries(): { level: number; err?: { message: string } }[] {
  return lines
    .map((line) => JSON.parse(line) as { level: number; err?: { message: string } })
    .filter((entry) => entry.level >= 50);
}

describe('logs y errores de inscribir sin datos personales (RNF-03, EC-09, EC-24)', () => {
  it('RNF-03 404, 409 y los 500 de los puertos y del recálculo → ni cuerpo ni logs con nombre, email, teléfono ni nota', async () => {
    const { candidate, rejectedId, jobId } = await seed();
    const second = await createPublishedJob(app, { title: 'Otra oferta inventada' });
    const draft = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: { title: 'Borrador inventado' },
    });
    const draftId = draft.json<{ id: number }>().id;

    const noJob = await enroll(app, 99999, candidate.id);
    const noCandidate = await enroll(app, jobId, 99999);
    const notPublished = await enroll(app, draftId, candidate.id);
    const repeated = await enroll(app, jobId, candidate.id);

    expectErrorBody(noJob, 404, 'NOT_FOUND');
    expectErrorBody(noCandidate, 404, 'NOT_FOUND');
    expectErrorBody(notPublished, 409, 'INVALID_TRANSITION');
    expectErrorBody(repeated, 409, 'DUPLICATE');
    expect(repeated.json<{ error: { details: unknown[] } }>().error.details).toEqual([
      expect.objectContaining({ field: 'candidateId', existingId: rejectedId }),
    ]);
    expect(
      Object.keys(repeated.json<{ error: { details: object[] } }>().error.details[0]!),
    ).toEqual(['field', 'message', 'existingId']);
    expectNoPersonalData(logs());
    expect(errorEntries()).toEqual([]);

    failStatus = true;
    const statusFailure = await enroll(app, second.id, candidate.id);
    failStatus = false;
    failProcesses = true;
    const processesFailure = await enroll(app, second.id, candidate.id);
    failProcesses = false;
    failWrites(db, 'UPDATE', { table: 'candidates', column: 'retention_ends_at' });
    const recalcFailure = await enroll(app, second.id, candidate.id);

    for (const response of [statusFailure, processesFailure, recalcFailure]) {
      expectErrorBody(response, 500, 'INTERNAL_ERROR');
    }
    expectNoPersonalData(logs());
    const messages = errorEntries().map((entry) => entry.err?.message);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toContain('puerto de estado');
    expect(messages[1]).toContain('puerto');
    expect(messages[2]).toContain('fallo simulado');
    expect(Number(db.prepare('SELECT COUNT(*) AS n FROM applications').get()?.n)).toBe(1);
  });
});
