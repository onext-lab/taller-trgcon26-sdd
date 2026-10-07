import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { createJobStatusReader } from '../../src/modules/jobs/job-status.ts';
import { createJobsRepository } from '../../src/modules/jobs/repository.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { createJobStatusSpy, enroll, type JobStatusSpy } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  closeJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
} from '../helpers/test-app.ts';

// TASK-07 [adversarial]: POST /api/applications con entradas hostiles y carreras. Datos inventados.
// «No se crea nada» = `SELECT COUNT(*)` de `applications` y de `stage_changes` a 0 y retención del candidato igual.
const NOW = '2026-10-07T10:00:00.000Z';
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const UNKNOWN_KEYS = { field: 'body', message: 'Hay campos no permitidos.' };
const NOT_PUBLISHED = {
  error: {
    code: 'INVALID_TRANSITION',
    message: 'La oferta no está publicada: no admite inscripciones.',
  },
};

let app: FastifyInstance;
let db: DatabaseSync;
let jobId: number;
let candidate: Candidate;
let initialRetention: string | null;

async function seed(): Promise<void> {
  jobId = (await createPublishedJob(app)).id;
  candidate = await createCandidate(app, {
    fullName: 'Candidata Inventada',
    email: 'candidata@example.com',
    phone: '+34 600 000 001',
  });
  initialRetention = await retentionOf(candidate.id);
}

beforeEach(async () => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
  await seed();
});

afterEach(async () => {
  await app.close();
});

function count(table: 'applications' | 'stage_changes'): number {
  return Number(db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get()?.total);
}

async function retentionOf(candidateId: number): Promise<string | null> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${candidateId}` });
  return response.json<Candidate>().retentionEndsAt;
}

function post(payload: string, contentType = 'application/json') {
  const headers = { 'content-type': contentType };
  return app.inject({ method: 'POST', url: '/api/applications', headers, payload });
}

interface ErrorBody {
  error: { code: string; message: string; details?: unknown[] };
}

/** Nada creado y la retención del candidato sigue como estaba. */
async function expectNothingCreated(): Promise<void> {
  expect(count('applications')).toBe(0);
  expect(count('stage_changes')).toBe(0);
  expect(await retentionOf(candidate.id)).toBe(initialRetention);
}

function expectNoLeak(response: LightMyRequestResponse): void {
  for (const text of ['stack', 'SQLITE', candidate.email, candidate.fullName, '600 000']) {
    expect(response.body).not.toContain(text);
  }
}

describe('POST /api/applications — cuerpo inválido (CA-10, EC-01, EC-02)', () => {
  const ok = () => ({ jobId, candidateId: candidate.id });

  it.each<[string, (ids: { jobId: number; candidateId: number }) => unknown, unknown[]]>([
    [
      'sin candidateId',
      ({ jobId: j }) => ({ jobId: j }),
      [{ field: 'candidateId', message: 'Es obligatorio.' }],
    ],
    [
      'sin jobId',
      ({ candidateId: c }) => ({ candidateId: c }),
      [{ field: 'jobId', message: 'Es obligatorio.' }],
    ],
    [
      'candidateId "12" (texto)',
      ({ jobId: j }) => ({ jobId: j, candidateId: '12' }),
      [{ field: 'candidateId', message: 'Debe ser un número entero.' }],
    ],
    [
      'candidateId 0',
      ({ jobId: j }) => ({ jobId: j, candidateId: 0 }),
      [{ field: 'candidateId', message: 'Debe ser mayor o igual que 1.' }],
    ],
    [
      'candidateId -3',
      ({ jobId: j }) => ({ jobId: j, candidateId: -3 }),
      [{ field: 'candidateId', message: 'Debe ser mayor o igual que 1.' }],
    ],
    [
      'candidateId 1.5',
      ({ jobId: j }) => ({ jobId: j, candidateId: 1.5 }),
      [{ field: 'candidateId', message: 'Debe ser un número entero.' }],
    ],
    [
      'CA-03 candidateId como lista',
      ({ jobId: j, candidateId: c }) => ({ jobId: j, candidateId: [c] }),
      [{ field: 'candidateId', message: 'Debe ser un número entero.' }],
    ],
    ['stage "hired" (mass assignment)', (ids) => ({ ...ids, stage: 'hired' }), [UNKNOWN_KEYS]],
    [
      'stage, id y createdAt a la vez',
      (ids) => ({ ...ids, stage: 'hired', id: 99, createdAt: 'x' }),
      [UNKNOWN_KEYS],
    ],
  ])('EC-01/EC-02 %s → 400 sin filas', async (_name, build, details) => {
    const response = await post(JSON.stringify(build(ok())));

    expect(response.statusCode).toBe(400);
    expect(response.json<ErrorBody>().error).toMatchObject({ code: 'VALIDATION_ERROR', details });
    expect(response.json<ErrorBody>().error.details).toHaveLength(details.length);
    for (const hostile of ['hired', 'createdAt']) expect(response.body).not.toContain(hostile);
    expectNoLeak(response);
    await expectNothingCreated();
  });

  it.each(['no es json', '', '[]', 'null'])('EC-01 cuerpo %j → 400', async (raw) => {
    const response = await post(raw);

    expect(response.statusCode).toBe(400);
    expect(response.json<ErrorBody>().error.code).toBe('VALIDATION_ERROR');
    expectNoLeak(response);
    await expectNothingCreated();
  });

  it('EC-01 text/plain → 400 y application/x-www-form-urlencoded → 415, sin filas', async () => {
    const plain = await post(`jobId=${jobId}&candidateId=${candidate.id}`, 'text/plain');
    const form = await post(
      `jobId=${jobId}&candidateId=${candidate.id}`,
      'application/x-www-form-urlencoded',
    );

    expect(plain.statusCode).toBe(400);
    expect(form.statusCode).toBe(415);
    expect(form.json<ErrorBody>().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    await expectNothingCreated();
  });
});

describe('POST /api/applications — límites de los IDs (EC-03)', () => {
  it.each(['jobId', 'candidateId'] as const)(
    'EC-03 %s = MAX_SAFE_INTEGER inexistente → 404 sin datos',
    async (field) => {
      const ids = { jobId, candidateId: candidate.id, [field]: MAX_SAFE };

      const response = await enroll(app, ids.jobId, ids.candidateId);

      expect(response.statusCode).toBe(404);
      expect(response.json<ErrorBody>().error.code).toBe('NOT_FOUND');
      expect(response.json<ErrorBody>().error).not.toHaveProperty('details');
      expectNoLeak(response);
      await expectNothingCreated();
    },
  );

  it.each(['jobId', 'candidateId'] as const)(
    'EC-03 %s = MAX_SAFE_INTEGER + 1 → 400 en ese campo',
    async (field) => {
      const ids = { jobId: String(jobId), candidateId: String(candidate.id) };
      ids[field] = String(MAX_SAFE + 1);

      const response = await post(`{"jobId":${ids.jobId},"candidateId":${ids.candidateId}}`);

      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorBody>().error.details).toEqual([
        { field, message: `Debe ser menor o igual que ${MAX_SAFE}.` },
      ]);
      await expectNothingCreated();
    },
  );
});

describe('POST /api/applications — peticiones entre sitios (EC-10)', () => {
  it.each(['cross-site', 'same-site'])(
    'EC-10 Sec-Fetch-Site %s → 403 CROSS_SITE_REQUEST y 0 filas',
    async (site) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/applications',
        headers: { 'sec-fetch-site': site },
        payload: { jobId, candidateId: candidate.id },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: { code: 'CROSS_SITE_REQUEST', message: 'Petición no permitida desde otro sitio.' },
      });
      await expectNothingCreated();
    },
  );
});

describe('POST /api/applications — carreras (CA-07, EC-06, EC-07)', () => {
  it('CA-07/EC-06 dos POST a la vez → un 201 y un 409 con su ID; 1 inscripción y 1 StageChange', async () => {
    const responses = await Promise.all([
      enroll(app, jobId, candidate.id),
      enroll(app, jobId, candidate.id),
    ]);

    const created = responses.find((response) => response.statusCode === 201);
    const rejected = responses.find((response) => response.statusCode === 409);
    expect(created).toBeDefined();
    expect(rejected).toBeDefined();
    const message = 'Este candidato ya está inscrito en la oferta.';
    expect(rejected?.json()).toEqual({
      error: {
        code: 'DUPLICATE',
        message,
        details: [
          { field: 'candidateId', message, existingId: created?.json<{ id: number }>().id },
        ],
      },
    });
    expect(count('applications')).toBe(1);
    expect(count('stage_changes')).toBe(1);
    expect(await retentionOf(candidate.id)).toBeNull();
  });

  it('EC-07 la oferta se cierra antes del POST → 409 INVALID_TRANSITION y 0 filas', async () => {
    await closeJob(app, jobId);

    const response = await enroll(app, jobId, candidate.id);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(NOT_PUBLISHED);
    await expectNothingCreated();
  });
});

describe('POST /api/applications — estado leído dentro de la transacción (EC-19, DD-02)', () => {
  let spy: JobStatusSpy;

  beforeEach(async () => {
    // Misma composición que `createTestApp`, pero con el espía sobre el lector real del estado de la oferta.
    await app.close();
    db = openDatabase(':memory:');
    migrate(db);
    const reader = createJobStatusReader(createJobsRepository(db));
    spy = createJobStatusSpy(db, reader);
    app = buildApp({ db, now: createTestClock(NOW).now, jobStatus: spy.port });
    await seed();
  });

  it('EC-19 el puerto se lee con db.isTransaction === true; cerrar y luego inscribir → 409', async () => {
    await closeJob(app, jobId);

    const response = await enroll(app, jobId, candidate.id);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(NOT_PUBLISHED);
    expect(spy.insideTransaction).toEqual([true]);
    await expectNothingCreated();
  });

  it('EC-19 la lectura también va dentro de la transacción al inscribir y al repetir', async () => {
    const first = await enroll(app, jobId, candidate.id);
    const again = await enroll(app, jobId, candidate.id);

    expect([first.statusCode, again.statusCode]).toEqual([201, 409]);
    expect(spy.insideTransaction).toEqual([true, true]);
  });
});
