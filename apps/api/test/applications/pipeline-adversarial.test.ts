import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertApplicationWithHistory, type SeedStep } from '../../src/db/seed-applications.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { Pipeline } from '../../src/modules/applications/schemas.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// TASK-09 [adversarial] (EC-26, EC-29, EC-30, RNF-04): el pipeline frente a entrada hostil, a un fallo de la base y a
// datos personales presentes en la base. Datos inventados.
const NOW = '2026-10-07T10:00:00.000Z';
const AT = '2026-09-01T09:00:00.000Z';
const PIPELINE_KEYS = ['items', 'job'];
const ITEM_KEYS = ['candidateName', 'id', 'lastChangeAt', 'rejectionReason', 'stage'];
const INTERNAL_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};

interface ValidationBody {
  error: { code: string; details: { field: string }[] };
}

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

function get(jobId: string, query = '') {
  return app.inject({ method: 'GET', url: `/api/jobs/${jobId}/applications${query}` });
}

function enrollDirect(jobId: number, candidateId: number, steps: readonly SeedStep[]) {
  return insertApplicationWithHistory(createApplicationsRepository(db), {
    candidateId,
    jobId,
    steps,
  });
}

describe('EC-26 jobId y querystring hostiles', () => {
  const INVALID_IDS = [
    ['abc', 'abc'],
    ['0', '0'],
    ['01', '01'],
    ['16 dígitos', '1234567890123456'],
    ['negativo', '-1'],
    ['decimal', '1.5'],
    ['notación científica', '1e3'],
  ] as const;

  it.each(INVALID_IDS)(
    'EC-26 jobId %s → 400 con details { field: jobId } sin repetir el valor',
    async (_name, id) => {
      const response = await get(id);

      expect(response.statusCode).toBe(400);
      const { error } = response.json<ValidationBody>();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details.map((detail) => detail.field)).toEqual(['jobId']);
      expect(response.body).not.toContain(id);
    },
  );

  it('EC-26 ?foo=1 sobre una oferta real → 400 con details { field: querystring } sin repetir foo', async () => {
    const job = await createPublishedJob(app);

    const response = await get(String(job.id), '?foo=1');

    expect(response.statusCode).toBe(400);
    const { error } = response.json<ValidationBody>();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.map((detail) => detail.field)).toEqual(['querystring']);
    expect(response.body).not.toContain('foo');
  });

  it('EC-26 filtros y paginación no existen: ?stage, ?page, ?limit y claves repetidas → 400', async () => {
    const job = await createPublishedJob(app);

    for (const query of ['?stage=received', '?page=2', '?limit=10', '?foo=1&foo=2']) {
      const response = await get(String(job.id), query);
      expect(response.statusCode, query).toBe(400);
    }
  });
});

describe('EC-29 error de la base al leer', () => {
  it('EC-29 tabla applications renombrada → 500 en el envelope, sin SQL, nombres de tabla ni stack', async () => {
    const job = await createPublishedJob(app);
    db.exec('ALTER TABLE applications RENAME TO applications_gone');

    const response = await get(String(job.id));

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(INTERNAL_ERROR);
    for (const leak of [
      'SQLITE',
      'no such table',
      'applications',
      'SELECT',
      'node:sqlite',
      ' at ',
    ]) {
      expect(response.body, leak).not.toContain(leak);
    }
  });

  it('EC-29 con la tabla restaurada la misma petición vuelve a responder 200 (el 500 no deja estado)', async () => {
    const job = await createPublishedJob(app);
    db.exec('ALTER TABLE applications RENAME TO applications_gone');
    expect((await get(String(job.id))).statusCode).toBe(500);

    db.exec('ALTER TABLE applications_gone RENAME TO applications');

    const response = await get(String(job.id));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ job: { id: job.id, status: 'published' }, items: [] });
  });
});

describe('EC-30 minimización con datos personales en la base (RNF-04)', () => {
  const FIRST_PHONE = '+34 600 000 031';
  const SECOND_PHONE = '+34 600 000 032';
  const NOTE = 'Nota interna inventada: no encaja con el perfil técnico';
  const SUMMARY = 'Resumen inventado del candidato con experiencia en nóminas';
  const FORBIDDEN_KEYS = ['email', 'phone', 'note', 'summary', 'consent', 'candidateId'];

  it('EC-30 0 claves y 0 valores de email, teléfono, nota ni resumen en el JSON serializado', async () => {
    const job = await createPublishedJob(app);
    const people = [
      await createCandidate(app, {
        fullName: 'Candidata Inventada Uno',
        email: 'uno.inventada@example.com',
        phone: FIRST_PHONE,
        summary: SUMMARY,
      }),
      await createCandidate(app, {
        fullName: 'Candidato Inventado Dos',
        email: 'dos.inventado@example.com',
        phone: SECOND_PHONE,
      }),
    ];
    enrollDirect(job.id, people[0]!.id, [{ stage: 'received', at: AT }]);
    enrollDirect(job.id, people[1]!.id, [
      { stage: 'received', at: AT },
      { stage: 'rejected', at: '2026-09-02T09:00:00.000Z', reason: 'other', note: NOTE },
    ]);
    const stored = db.prepare('SELECT COUNT(*) AS n FROM stage_changes WHERE note = ?').get(NOTE);
    expect(stored?.n).toBe(1);

    const response = await get(String(job.id));

    expect(response.statusCode).toBe(200);
    const body = response.json<Pipeline>();
    expect(body.items).toHaveLength(2);
    expect(Object.keys(body).sort()).toEqual(PIPELINE_KEYS);
    for (const item of body.items) expect(Object.keys(item).sort()).toEqual(ITEM_KEYS);
    for (const key of FORBIDDEN_KEYS) {
      expect(response.body.toLowerCase(), key).not.toContain(`"${key.toLowerCase()}"`);
    }
    const forbiddenValues = [
      ...people.map((person) => person.email),
      FIRST_PHONE,
      SECOND_PHONE,
      '+34 600',
      'Nota interna',
      NOTE,
      SUMMARY,
    ];
    for (const value of forbiddenValues) expect(response.body, value).not.toContain(value);
  });
});
