import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { Writable } from 'node:stream';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { loggerOptions } from '../../src/logger.ts';
import type { Application, Stage } from '../../src/modules/applications/schemas.ts';
import { advance, getApplication, insertApplicationAt, reject } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestClock, failWrites } from '../helpers/test-app.ts';

// TASK-08 [adversarial] (CA-21, RNF-04, RNF-05, EC-09): con el logger de la app capturado, ni los logs ni los cuerpos
// de error de avanzar, rechazar y consultar el detalle llevan datos personales, y la nota solo sale en el detalle.
// Datos inventados; el marcador no es un dato personal.
const START_AT = '2026-10-01T09:00:00.000Z';
const NOW = '2026-10-07T10:00:00.000Z';
const MARKER = 'MARCA-NOTA-7Q';
const PERSON = {
  fullName: 'Irene Valdecasas Portillo',
  email: 'irene.valdecasas@example.com',
  phone: '+34 600 000 088',
};
const PERSONAL = [
  PERSON.fullName,
  'Irene',
  'Valdecasas',
  'irene.valdecasas',
  PERSON.email,
  '600 000 088',
];

let app: FastifyInstance;
let db: DatabaseSync;
let lines: string[];
let candidateId: number;

beforeEach(async () => {
  lines = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  db = openDatabase(':memory:');
  migrate(db);
  app = buildApp({ db, now: createTestClock(NOW).now, logger: { ...loggerOptions, stream } });
  candidateId = (await createCandidate(app, { ...PERSON, consent: false })).id;
});

afterEach(async () => {
  await app.close();
});

const logs = (): string => lines.join('');

/** Inscripción en la última etapa de `path`, en una oferta publicada nueva (una por candidato y oferta). */
async function seedAt(...path: Stage[]): Promise<Application> {
  const job = await createPublishedJob(app);
  return insertApplicationAt(db, {
    jobId: job.id,
    candidateId,
    path: ['received', ...path],
    startAt: START_AT,
  });
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

describe('datos personales en logs y errores del cambio de etapa y del detalle', () => {
  it('CA-21 marcador de la nota ausente de logs, 400, 500, respuesta del rechazo y pipeline; presente solo en el detalle', async () => {
    const ok = await seedAt('screening');
    const tooLong = await seedAt('screening');
    const failing = await seedAt('screening');
    const note = `${MARKER} nota inventada del rechazo`;

    const rejected = await reject(app, ok.id, {
      expectedStage: 'screening',
      reason: 'not_a_fit',
      note,
    });
    const invalid = await reject(app, tooLong.id, {
      expectedStage: 'screening',
      reason: 'not_a_fit',
      note: `${MARKER}${'x'.repeat(501 - MARKER.length)}`,
    });
    failWrites(db, 'INSERT', { table: 'stage_changes' });
    const broken = await reject(app, failing.id, {
      expectedStage: 'screening',
      reason: 'not_a_fit',
      note,
    });

    expect(rejected.statusCode).toBe(200);
    expectErrorBody(invalid, 400, 'VALIDATION_ERROR');
    expectErrorBody(broken, 500, 'INTERNAL_ERROR');
    const pipeline = await app.inject({ method: 'GET', url: `/api/jobs/${ok.jobId}/applications` });
    expect(pipeline.statusCode).toBe(200);
    for (const text of [logs(), invalid.body, broken.body, rejected.body, pipeline.body]) {
      expect(text).not.toContain(MARKER);
    }
    const detail = await getApplication(app, ok.id);
    expect(detail.statusCode).toBe(200);
    expect(detail.body).toContain(MARKER);
    expect(logs()).not.toContain(MARKER);
  });

  it('RNF-04 nombre, email y teléfono ausentes de logs y cuerpos de 404, 409 y 500 de avance, rechazo y detalle', async () => {
    const screening = await seedAt('screening');
    const hired = await seedAt('screening', 'interview', 'offer', 'hired');
    const toAdvance = await seedAt('screening');
    const toReject = await seedAt('screening');
    const note = `${MARKER} nota inventada`;

    const notFound = [
      await advance(app, 99999, { expectedStage: 'received', toStage: 'screening' }),
      await reject(app, 99999, { expectedStage: 'received', reason: 'not_a_fit', note }),
      await getApplication(app, 99999),
    ];
    const mismatch = [
      await advance(app, screening.id, { expectedStage: 'received', toStage: 'interview' }),
      await reject(app, screening.id, { expectedStage: 'received', reason: 'not_a_fit', note }),
    ];
    const invalid = [
      await advance(app, screening.id, { expectedStage: 'screening', toStage: 'offer' }),
      await advance(app, hired.id, { expectedStage: 'hired', toStage: 'offer' }),
      await reject(app, hired.id, { expectedStage: 'hired', reason: 'not_a_fit', note }),
    ];
    for (const response of notFound) expectErrorBody(response, 404, 'NOT_FOUND');
    for (const response of mismatch) expectErrorBody(response, 409, 'STAGE_MISMATCH');
    for (const response of invalid) expectErrorBody(response, 409, 'INVALID_TRANSITION');
    expectNoPersonalData(logs());
    expect(logs()).not.toContain(MARKER);

    failWrites(db, 'INSERT', { table: 'stage_changes' });
    const failures = [
      await advance(app, toAdvance.id, { expectedStage: 'screening', toStage: 'interview' }),
      await reject(app, toReject.id, { expectedStage: 'screening', reason: 'not_a_fit', note }),
    ];
    db.exec('ALTER TABLE candidates RENAME TO candidates_x');
    failures.push(await getApplication(app, toAdvance.id));

    expect(failures).toHaveLength(3);
    for (const response of failures) expectErrorBody(response, 500, 'INTERNAL_ERROR');
    expectNoPersonalData(logs());
    expect(logs()).not.toContain(MARKER);
    const errors = lines.filter((line) => (JSON.parse(line) as { level: number }).level >= 50);
    expect(errors).toHaveLength(3);
  });
});
