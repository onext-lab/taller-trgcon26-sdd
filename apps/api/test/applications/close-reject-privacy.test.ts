import type { FastifyInstance } from 'fastify';
import { Writable } from 'node:stream';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { loggerOptions } from '../../src/logger.ts';
import type { Application } from '../../src/modules/applications/schemas.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { advance, insertApplicationAt, reject } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestClock, failWrites } from '../helpers/test-app.ts';

// HU-06 TASK-05 [adversarial] (CA-11, RNF-03, RNF-04, EC-06, EC-13, EC-24): con el logger de la app capturado y el
// puerto real de `applications`, ni los cuerpos ni los logs del cierre, de la previa y del 409 posterior llevan datos
// personales. Datos inventados. Los fallos se instalan después de preparar los datos y sin `whenNew`.
const START_AT = '2026-10-05T09:00:00.000Z';
const CLOSED_AT = '2026-10-06T22:30:00.000Z';
const MARKED = {
  fullName: 'Marcador Privacidad',
  email: 'marcador.privacidad@example.com',
  phone: '+34 600 000 042',
};
const MARKERS = [
  MARKED.fullName,
  'Marcador',
  'Privacidad',
  MARKED.email,
  'marcador.privacidad',
  MARKED.phone,
  '600 000 042',
  '600000042',
];
const INTERNAL_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};

let app: FastifyInstance;
let db: DatabaseSync;
let lines: string[];
let job: Job;
let marked: Application;

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
  app = buildApp({
    db,
    now: createTestClock(CLOSED_AT).now,
    logger: { ...loggerOptions, stream },
  });
  job = await createPublishedJob(app);
  const candidate = await createCandidate(app, { ...MARKED, consent: false });
  marked = insertApplicationAt(db, {
    jobId: job.id,
    candidateId: candidate.id,
    path: ['received', 'screening'],
    startAt: START_AT,
  });
});

afterEach(async () => {
  await app.close();
});

const logs = (): string => lines.join('');
const postClose = (id: number) => app.inject({ method: 'POST', url: `/api/jobs/${id}/close` });

function expectNoMarkers(text: string): void {
  for (const marker of MARKERS) expect(text).not.toContain(marker);
}

const FAILURE_POINTS: [string, () => void][] = [
  ['UPDATE de applications', () => failWrites(db, 'UPDATE', { table: 'applications' })],
  ['INSERT de stage_changes', () => failWrites(db, 'INSERT', { table: 'stage_changes' })],
  [
    'UPDATE de retention_ends_at',
    () => failWrites(db, 'UPDATE', { table: 'candidates', column: 'retention_ends_at' }),
  ],
];

describe('cierre de oferta con inscripciones activas: datos personales (CA-11, EC-06)', () => {
  it.each(FAILURE_POINTS)(
    'CA-11 fallo en %s: ni el 500 ni el log llevan nombre, email ni teléfono',
    async (_name, installFailure) => {
      installFailure();

      const response = await postClose(job.id);

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual(INTERNAL_ERROR);
      expectNoMarkers(response.body);
      expect(response.body).not.toContain('SQLITE');
      expect(response.body).not.toContain('stack');
      // El log no puede estar vacío: si lo estuviera, la búsqueda de marcadores no probaría nada.
      expect(lines.length).toBeGreaterThan(0);
      const errorLines = lines.filter(
        (line) => (JSON.parse(line) as { level: number }).level >= 50,
      );
      expect(errorLines.length).toBeGreaterThanOrEqual(1);
      for (const line of lines) expectNoMarkers(line);
      expectNoMarkers(logs());
    },
  );
});

describe('previa del cierre: minimización (EC-13)', () => {
  it('EC-13 previa con 1 clave y 404 sin datos', async () => {
    const preview = await app.inject({ method: 'GET', url: `/api/jobs/${job.id}/close-preview` });
    const missing = await app.inject({ method: 'GET', url: '/api/jobs/999999/close-preview' });

    expect(preview.statusCode).toBe(200);
    expect(Object.keys(preview.json<object>())).toEqual(['activeApplications']);
    expect(preview.json()).toEqual({ activeApplications: 1 });
    expectNoMarkers(preview.body);
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'La oferta no existe.' },
    });
    expectNoMarkers(missing.body);
    expectNoMarkers(logs());
  });
});

describe('cambio de etapa tras el cierre (EC-24)', () => {
  it('EC-24 409 tras el cierre sin datos; reject con job_closed → 400', async () => {
    const closed = await postClose(job.id);
    expect(closed.statusCode).toBe(200);

    const stale = await advance(app, marked.id, {
      expectedStage: 'screening',
      toStage: 'interview',
    });
    const manual = await reject(app, marked.id, {
      expectedStage: 'rejected',
      reason: 'job_closed',
    });

    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({
      error: {
        code: 'STAGE_MISMATCH',
        message: 'La inscripción ha cambiado de etapa: recarga e inténtalo de nuevo.',
      },
    });
    expectNoMarkers(stale.body);
    expect(manual.statusCode).toBe(400);
    expect(manual.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expectNoMarkers(manual.body);
    expectNoMarkers(logs());
  });
});

describe('respuesta del cierre: claves del Job (RNF-04)', () => {
  it('RNF-04 POST /close con las claves del Job', async () => {
    const before = await app.inject({ method: 'GET', url: `/api/jobs/${job.id}` });

    const closed = await postClose(job.id);
    const after = await app.inject({ method: 'GET', url: `/api/jobs/${job.id}` });

    expect(closed.statusCode).toBe(200);
    expect(Object.keys(closed.json<object>()).sort()).toEqual(
      Object.keys(before.json<object>()).sort(),
    );
    expect(Object.keys(closed.json<object>()).sort()).toEqual(
      Object.keys(after.json<object>()).sort(),
    );
    expect(closed.json()).toEqual(after.json());
    expect(closed.json()).toMatchObject({ status: 'closed', closedAt: CLOSED_AT });
    expect(closed.body).not.toMatch(/rejected|activeApplications|count/i);
    expectNoMarkers(closed.body);
    expectNoMarkers(logs());
  });
});
