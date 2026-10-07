import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApplicationDetail } from '../../src/modules/applications/schemas.ts';
import {
  createJobStatusStub,
  getApplication,
  insertApplicationAt,
} from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// TASK-08 [adversarial] (EC-19, EC-21, EC-22, EC-23, DD-08): `GET /api/applications/:id` frente a identificadores
// hostiles, dependencias rotas, datos corruptos y exposición de datos personales. Datos inventados.
const START_AT = '2026-10-01T09:00:00.000Z';
const NOW = '2026-10-07T10:00:00.000Z';
const PERSON = {
  fullName: 'Leonor Barrionuevo Salas',
  email: 'leonor.barrionuevo@example.com',
  phone: '+34 600 000 099',
};
const NOTE = 'Nota inventada del detalle.';
const GENERIC_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};

let app: FastifyInstance;
let db: DatabaseSync;

afterEach(async () => {
  await app.close();
});

/** App nueva con una inscripción rechazada con nota; devuelve su id y el del candidato. */
async function setUp(
  options: Parameters<typeof createTestApp>[0] = {},
): Promise<{ id: number; candidateId: number }> {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now, ...options }));
  const job = await createPublishedJob(app);
  const candidate = await createCandidate(app, { ...PERSON, consent: false });
  const application = insertApplicationAt(db, {
    jobId: job.id,
    candidateId: candidate.id,
    path: ['received', 'screening', 'rejected'],
    startAt: START_AT,
    reason: 'not_a_fit',
    note: NOTE,
  });
  return { id: application.id, candidateId: candidate.id };
}

/** Recorre el JSON y devuelve todas las claves de objeto que encuentra, a cualquier profundidad. */
function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...collectKeys(child)]);
}

function expectGenericError(response: { statusCode: number; body: string; json: () => unknown }) {
  expect(response.statusCode).toBe(500);
  expect(response.json()).toEqual(GENERIC_ERROR);
  for (const text of [PERSON.fullName, PERSON.email, '600 000 099', NOTE, 'SQLITE', 'stack']) {
    expect(response.body).not.toContain(text);
  }
}

describe('GET /api/applications/:id — hostil, roto y corrupto', () => {
  it.each([
    { name: 'abc', url: '/api/applications/abc', field: 'id' },
    { name: '0', url: '/api/applications/0', field: 'id' },
    { name: '?x=1', url: '/api/applications/1?x=1', field: 'querystring' },
  ])('EC-19 $name → 400', async ({ url, field }) => {
    await setUp();

    const response = await app.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(400);
    const { error } = response.json<{ error: { code: string; details: { field: string }[] } }>();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual([expect.objectContaining({ field })]);
    for (const text of [PERSON.fullName, PERSON.email, NOTE, 'stack']) {
      expect(response.body).not.toContain(text);
    }
  });

  it('EC-21 getJobSummary lanza → 500 sin datos', async () => {
    const { id } = await setUp({ jobStatus: createJobStatusStub({ failSummary: true }) });

    const response = await getApplication(app, id);

    expectGenericError(response);
    expect(response.body).not.toContain('fallo simulado');
  });

  it('EC-21 candidates renombrada → 500 sin datos', async () => {
    const { id } = await setUp();
    db.exec('ALTER TABLE candidates RENAME TO candidates_x');

    const response = await getApplication(app, id);

    expectGenericError(response);
    expect(response.body).not.toContain('candidates');
  });

  it('EC-22 sin nombre → 500, sin inventarlo (DD-08)', async () => {
    const { id, candidateId } = await setUp();
    db.exec('PRAGMA foreign_keys = OFF');
    db.prepare('DELETE FROM candidates WHERE id = ?').run(candidateId);

    const response = await getApplication(app, id);

    expectGenericError(response);
    expect(response.body).not.toContain('"fullName"');
    expect(response.body).not.toContain('sin candidato');
  });

  it('EC-23 0 claves email ni phone en todo el JSON; nombre y nota presentes', async () => {
    const { id } = await setUp();

    const response = await getApplication(app, id);

    expect(response.statusCode).toBe(200);
    const detail = response.json<ApplicationDetail>();
    expect(detail.candidate.fullName).toBe(PERSON.fullName);
    expect(detail.history.at(-1)?.note).toBe(NOTE);
    const keys = collectKeys(detail);
    expect(keys).toContain('fullName');
    expect(keys.filter((key) => key === 'email' || key === 'phone')).toHaveLength(0);
    expect(response.body).not.toContain(PERSON.email);
    expect(response.body).not.toContain('600 000 099');
  });
});
