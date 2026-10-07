import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { Application, Stage } from '../../src/modules/applications/schemas.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { advance, insertApplicationAt, reject } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// TASK-06 [adversarial]: avanzar y rechazar con entradas hostiles, desde otro sitio y a la vez. Datos inventados.
// «Nada cambia» = misma inscripción (etapa y `lastChangeAt`), mismo historial y misma retención del candidato.
const START_AT = '2026-10-01T09:00:00.000Z';
const NOW = '2026-10-07T10:00:00.000Z';
const JSON_TYPE = { 'content-type': 'application/json' };
const UNKNOWN_KEYS = { field: 'body', message: 'Hay campos no permitidos.' };
const BAD_ID = [{ field: 'id', message: 'Formato no válido.' }];
const NOT_TEXT = 'Debe ser un texto.';
const ADVANCE_OK = { expectedStage: 'screening', toStage: 'interview' };
const REJECT_OK = { expectedStage: 'screening', reason: 'other' };
const MISMATCH = {
  error: {
    code: 'STAGE_MISMATCH',
    message: 'La inscripción ha cambiado de etapa: recarga e inténtalo de nuevo.',
  },
};

interface ErrorBody {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
}

interface Seeded {
  application: Application;
  candidate: Candidate;
}

let app: FastifyInstance;
let db: DatabaseSync;
let jobId: number;
let counter = 0;

beforeEach(async () => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
  jobId = (await createPublishedJob(app)).id;
});

afterEach(async () => {
  await app.close();
});

/** Una candidata nueva por inscripción (la pareja candidata-oferta es única), ya en la última etapa de `path`. */
async function seedAt(...path: Stage[]): Promise<Seeded> {
  counter += 1;
  const candidate = await createCandidate(app, {
    fullName: 'Candidata Inventada',
    email: `candidata.hostil${counter}@example.com`,
    phone: '+34 600 000 002',
  });
  const application = insertApplicationAt(db, {
    jobId,
    candidateId: candidate.id,
    path: ['received', ...path],
    startAt: START_AT,
  });
  return { application, candidate };
}

const history = (id: number) => createApplicationsRepository(db).listHistory(id);

/** Foto del estado observable de una inscripción y de la retención de su candidato. */
async function snapshot({ application, candidate }: Seeded) {
  return {
    application: createApplicationsRepository(db).findById(application.id),
    history: history(application.id),
    retention: (
      await app.inject({ method: 'GET', url: `/api/candidates/${candidate.id}` })
    ).json<Candidate>().retentionEndsAt,
  };
}

function count(table: 'applications' | 'stage_changes'): number {
  return Number(db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get()?.total);
}

function expectNoLeak(response: LightMyRequestResponse, { candidate }: Seeded): void {
  for (const text of ['stack', 'SQLITE', candidate.email, candidate.fullName, '600 000']) {
    expect(response.body).not.toContain(text);
  }
}

/** 400 `VALIDATION_ERROR` con exactamente esos `details` (cada uno, parcial) y sin ningún valor hostil recibido. */
function expectInvalid(
  response: LightMyRequestResponse,
  name: string,
  details: unknown,
  hostile: string[],
  seeded: Seeded,
): void {
  const expected = (details as object[]).map((detail) => expect.objectContaining(detail));
  expect(response.statusCode, name).toBe(400);
  expect(response.json<ErrorBody>().error.code, name).toBe('VALIDATION_ERROR');
  expect(response.json<ErrorBody>().error.details, name).toEqual(expected);
  for (const text of hostile) expect(response.body, name).not.toContain(text);
  expectNoLeak(response, seeded);
}

describe('POST /api/applications/:id/advance — entradas inválidas (EC-01, EC-02, CA-09)', () => {
  it('CA-09 etapa desconocida, sin esperada, note de más, cuerpo vacío o no JSON, :id inválido → 400 y nada cambia', async () => {
    const seeded = await seedAt('screening');
    const before = await snapshot(seeded);
    const id = seeded.application.id;
    const cases: [string, unknown, unknown][] = [
      ['sin expectedStage', { toStage: 'interview' }, [{ field: 'expectedStage' }]],
      ['toStage desconocida', { ...ADVANCE_OK, toStage: 'foo' }, [{ field: 'toStage' }]],
      ['etapa numérica', { ...ADVANCE_OK, toStage: 3 }, [{ field: 'toStage', message: NOT_TEXT }]],
      ['objeto vacío', {}, [{ field: 'expectedStage' }, { field: 'toStage' }]],
      ['note de más', { ...ADVANCE_OK, note: 'Nota inventada' }, [UNKNOWN_KEYS]],
      ['reason y note de más', { ...ADVANCE_OK, reason: 'other', note: 'x' }, [UNKNOWN_KEYS]],
    ];

    for (const [name, body, details] of cases) {
      const response = await advance(app, id, body);
      expectInvalid(response, name, details, ['foo', 'Nota inventada', 'other'], seeded);
    }
    for (const raw of ['', 'no es json', '{"expectedStage":']) {
      const response = await advance(app, id, raw, JSON_TYPE);

      expect(response.statusCode, raw).toBe(400);
      expect(response.json<ErrorBody>().error.message, raw).toBe(
        'El cuerpo de la petición no es JSON válido.',
      );
    }
    for (const body of ['null', '[]', '"texto"']) {
      expect((await advance(app, id, body, JSON_TYPE)).statusCode, body).toBe(400);
    }
    const badId = await advance(app, 'abc', { toStage: 'foo' });
    expect(badId.statusCode).toBe(400);
    expect(badId.json<ErrorBody>().error.details).toEqual(BAD_ID);
    expect(await snapshot(seeded)).toEqual(before);
  });

  it("EC-02 abc, 0, 01 y 16 dígitos → 400 { field: 'id' }", async () => {
    const seeded = await seedAt('screening');
    const before = await snapshot(seeded);

    for (const id of ['abc', '0', '01', '9007199254740991']) {
      for (const send of [advance, reject]) {
        const response = await send(app, id, send === advance ? ADVANCE_OK : REJECT_OK);

        expect(response.statusCode, id).toBe(400);
        expect(response.json<ErrorBody>().error.code).toBe('VALIDATION_ERROR');
        expect(response.json<ErrorBody>().error.details).toEqual(BAD_ID);
        expect(response.body).not.toContain(`"${id}"`);
      }
    }
    const both = await reject(app, 'abc', { toStage: 'foo', reason: 9 });
    expect(both.json<ErrorBody>().error.details).toEqual(BAD_ID);
    expect(await snapshot(seeded)).toEqual(before);
  });
});

describe('POST /api/applications/:id/reject — entradas inválidas (EC-11, EC-12)', () => {
  it('EC-11 reason numérico, note no texto, toStage de más → 400', async () => {
    const seeded = await seedAt('screening');
    const before = await snapshot(seeded);
    const cases: [string, unknown, unknown][] = [
      ['reason numérico', { ...REJECT_OK, reason: 7 }, [{ field: 'reason', message: NOT_TEXT }]],
      ['note numérica', { ...REJECT_OK, note: 42 }, [{ field: 'note', message: NOT_TEXT }]],
      ['note objeto', { ...REJECT_OK, note: { texto: 'Nota inventada' } }, [{ field: 'note' }]],
      ['note lista', { ...REJECT_OK, note: ['Nota inventada'] }, [{ field: 'note' }]],
      ['toStage de más', { ...REJECT_OK, toStage: 'rejected' }, [UNKNOWN_KEYS]],
      ['stage de más', { ...REJECT_OK, stage: 'hired' }, [UNKNOWN_KEYS]],
      ['ambas de más', { ...REJECT_OK, toStage: 'hired', stage: 'hired' }, [UNKNOWN_KEYS]],
    ];

    for (const [name, body, details] of cases) {
      const response = await reject(app, seeded.application.id, body);
      expectInvalid(response, name, details, ['Nota inventada', 'hired', '42'], seeded);
    }
    expect(await snapshot(seeded)).toEqual(before);
  });

  it('EC-12 NUL y U+0007 → 400; \\n\\r\\t aceptados', async () => {
    const seeded = await seedAt('screening');
    const before = await snapshot(seeded);

    for (const control of ['\u0000', '\u0007']) {
      const note = `Nota inventada ${control} con control`;
      const response = await reject(app, seeded.application.id, { ...REJECT_OK, note });

      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorBody>().error.details).toEqual([
        { field: 'note', message: 'Formato no válido.' },
      ]);
      expect(response.body).not.toContain('Nota inventada');
      expect(response.body).not.toContain(control);
    }
    expect(await snapshot(seeded)).toEqual(before);

    const note = 'Línea uno\nlínea dos\r\n\tcon tabulador';
    const accepted = await reject(app, seeded.application.id, { ...REJECT_OK, note });

    expect(accepted.statusCode).toBe(200);
    expect(accepted.json<Application>().stage).toBe('rejected');
    expect(accepted.body).not.toContain('Línea');
    expect(history(seeded.application.id).at(-1)).toMatchObject({ toStage: 'rejected', note });
  });
});

describe('seguridad (EC-09 403, EC-17)', () => {
  it('EC-09 cross-site → 403 y nada cambia', async () => {
    const seeded = await seedAt('screening');
    const before = await snapshot(seeded);
    const headers = { 'sec-fetch-site': 'cross-site' };
    const forbidden = {
      error: { code: 'CROSS_SITE_REQUEST', message: 'Petición no permitida desde otro sitio.' },
    };
    const id = seeded.application.id;

    const advanced = await advance(app, id, ADVANCE_OK, headers);
    const rejected = await reject(app, id, REJECT_OK, headers);

    for (const response of [advanced, rejected]) {
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual(forbidden);
    }
    expect(await snapshot(seeded)).toEqual(before);
  });

  it.each([
    '<script>alert(1)</script>',
    'Dijo "no" y \'quizá\' <b onclick="x()">',
    "'; DROP TABLE applications; --",
    "x'); DELETE FROM stage_changes; --",
  ])('EC-17 nota con HTML y SQL guardada literal: %s', async (note) => {
    const seeded = await seedAt('screening', 'interview');
    const applications = count('applications');
    const changes = count('stage_changes');

    const response = await reject(app, seeded.application.id, {
      expectedStage: 'interview',
      reason: 'other',
      note,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<Application>().stage).toBe('rejected');
    expect(response.body).not.toContain('script');
    expect(history(seeded.application.id).at(-1)).toMatchObject({ toStage: 'rejected', note });
    // `count` falla si la tabla ya no existe: seguir contando prueba que `DROP TABLE` no se ejecutó.
    expect(count('applications')).toBe(applications);
    expect(count('stage_changes')).toBe(changes + 1);
  });
});

describe('concurrencia (EC-06, EC-15)', () => {
  it('EC-06 dos pestañas → STAGE_MISMATCH', async () => {
    const seeded = await seedAt('screening');
    const id = seeded.application.id;

    const first = await advance(app, id, ADVANCE_OK);
    const afterFirst = await snapshot(seeded);
    const second = await advance(app, id, { expectedStage: 'screening', toStage: 'offer' });

    expect(first.statusCode).toBe(200);
    expect(first.json<Application>().stage).toBe('interview');
    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual(MISMATCH);
    expect(await snapshot(seeded)).toEqual(afterFirst);
    expect(afterFirst.history).toHaveLength(3);
  });

  it('EC-15 rechazo y avance en paralelo → un 200 y un 409, 1 StageChange', async () => {
    const attempts: [string, (id: number) => Promise<LightMyRequestResponse>[]][] = [
      ['rechazo primero', (id) => [rejectIt(id), advanceIt(id)]],
      ['avance primero', (id) => [advanceIt(id), rejectIt(id)]],
    ];

    for (const [name, launch] of attempts) {
      const seeded = await seedAt('screening');
      const id = seeded.application.id;

      const responses = await Promise.all(launch(id));

      expect(responses.map((response) => response.statusCode).sort(), name).toEqual([200, 409]);
      const winner = responses.find((response) => response.statusCode === 200);
      const loser = responses.find((response) => response.statusCode === 409);
      expect(loser?.json(), name).toEqual(MISMATCH);
      expect(history(id), name).toHaveLength(3);
      expect(createApplicationsRepository(db).findById(id)?.stage, name).toBe(
        winner?.json<Application>().stage,
      );
    }
  });
});

const rejectIt = (id: number) => reject(app, id, REJECT_OK);
const advanceIt = (id: number) => advance(app, id, ADVANCE_OK);
