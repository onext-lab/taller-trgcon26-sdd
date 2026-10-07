import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { Application } from '../../src/modules/applications/schemas.ts';
import { insertApplicationAt, reject } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. Una inscripción nueva en `interview` por prueba, para que cada rechazo parta de cero.
const START_AT = '2026-10-01T09:00:00.000Z';
const NOW = '2026-10-07T10:00:00.000Z';

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

/** Una candidata nueva por inscripción: la pareja candidata-oferta es única. */
async function seedInterview(): Promise<Application> {
  counter += 1;
  const candidate = await createCandidate(app, {
    fullName: 'Candidata Inventada',
    email: `candidata.nota${counter}@example.com`,
  });
  return insertApplicationAt(db, {
    jobId,
    candidateId: candidate.id,
    path: ['received', 'screening', 'interview'],
    startAt: START_AT,
  });
}

const history = (applicationId: number) =>
  createApplicationsRepository(db).listHistory(applicationId);

/** Rechaza la inscripción en `interview` con la nota dada (`undefined` = sin la clave `note`). */
function rejectWith(id: number, note?: string | null) {
  const body = {
    expectedStage: 'interview',
    reason: 'other',
    ...(note === undefined ? {} : { note }),
  };
  return reject(app, id, body);
}

describe('POST /api/applications/:id/reject — nota', () => {
  it('CA-16 nota de 501 tras recortar → 400 sin la nota en el cuerpo; nada cambia', async () => {
    const created = await seedInterview();
    const note = `Nota inventada ${'x'.repeat(501 - 'Nota inventada '.length)}`;
    expect(note).toHaveLength(501);

    const response = await rejectWith(created.id, `  ${note}  `);

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
    expect(response.json<{ error: { details: { field: string }[] } }>().error.details).toEqual([
      expect.objectContaining({ field: 'note' }),
    ]);
    expect(response.body).not.toContain('Nota inventada');
    expect(createApplicationsRepository(db).findById(created.id)).toEqual(created);
    expect(history(created.id)).toHaveLength(3);
  });

  it('CA-16 nota solo de espacios → 200 y note null', async () => {
    const created = await seedInterview();

    const response = await rejectWith(created.id, ' \t \n ');

    expect(response.statusCode).toBe(200);
    expect(response.json<Application>().stage).toBe('rejected');
    expect(history(created.id).at(-1)).toMatchObject({ reason: 'other', note: null });
  });

  it('EC-13 500 → 200; 500 emojis → 200 (puntos de código); espacios alrededor → recortada; note ausente → null', async () => {
    const limit = 'a'.repeat(500);
    const emojis = '\u{1F600}'.repeat(500);
    const cases: [string | null | undefined, string | null][] = [
      [limit, limit],
      [emojis, emojis],
      ['  Prefiere jornada parcial.  ', 'Prefiere jornada parcial.'],
      [undefined, null],
      [null, null],
    ];

    for (const [sent, expected] of cases) {
      const created = await seedInterview();
      const response = await rejectWith(created.id, sent);

      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain('Prefiere');
      expect(history(created.id).at(-1)).toMatchObject({ toStage: 'rejected', note: expected });
    }
  });
});
