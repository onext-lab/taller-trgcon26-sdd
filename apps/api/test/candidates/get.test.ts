import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCandidate } from '../helpers/candidates.ts';
import { createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. Los endpoints de consentimiento llegan en TASK-04: aquí los estados «vigente» y «retirado» se
// preparan con el alta y un UPDATE directo que cumple los CHECK.
const NOW = '2026-10-06T22:30:00.000Z'; // 00:30 del 7 en Madrid (UTC+2)

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

function getCandidate(id: number | string) {
  return app.inject({ method: 'GET', url: `/api/candidates/${id}` });
}

const FIELDS = [
  'consentGivenAt',
  'consentVersion',
  'consentWithdrawnAt',
  'createdAt',
  'email',
  'fullName',
  'id',
  'phone',
  'retentionEndsAt',
  'skills',
  'summary',
];

describe('GET /api/candidates/:id — ficha (CA-22)', () => {
  it('CA-22 vigente: los 11 campos con el consentimiento y la retención + 24 meses', async () => {
    const created = await createCandidate(app, {
      fullName: 'Lucía Ferrer Soler',
      email: 'lucia.ferrer@example.com',
      phone: '+34 600 000 001',
      summary: 'Desarrolladora con 5 años de experiencia.',
      skills: ['TypeScript', 'sql'],
      consent: true,
    });

    const response = await getCandidate(created.id);

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.json()).sort()).toEqual(FIELDS);
    expect(response.json()).toEqual({
      id: created.id,
      fullName: 'Lucía Ferrer Soler',
      email: 'lucia.ferrer@example.com',
      phone: '+34 600 000 001',
      summary: 'Desarrolladora con 5 años de experiencia.',
      skills: ['typescript', 'sql'],
      createdAt: NOW,
      consentGivenAt: NOW,
      consentVersion: 'v1',
      consentWithdrawnAt: null,
      retentionEndsAt: '2028-10-07',
    });
  });

  it('CA-22 retirada: consentGivenAt y consentWithdrawnAt no nulos', async () => {
    const created = await createCandidate(app, {
      fullName: 'Marcos Peña Ortiz',
      email: 'marcos.pena@example.com',
      consent: true,
    });
    db.prepare(
      'UPDATE candidates SET consent_withdrawn_at = ?, retention_ends_at = ? WHERE id = ?',
    ).run('2026-11-02T10:00:00.000Z', '2027-04-07', created.id);

    const response = await getCandidate(created.id);

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.json()).sort()).toEqual(FIELDS);
    expect(response.json()).toMatchObject({
      consentGivenAt: NOW,
      consentVersion: 'v1',
      consentWithdrawnAt: '2026-11-02T10:00:00.000Z',
      retentionEndsAt: '2027-04-07',
    });
  });

  it('CA-22 nunca dada: consentimiento null y retención alta + 6 meses', async () => {
    const created = await createCandidate(app, {
      fullName: 'Sara Domínguez Ruiz',
      email: 'sara.dominguez@example.com',
    });

    const response = await getCandidate(created.id);

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.json()).sort()).toEqual(FIELDS);
    expect(response.json()).toMatchObject({
      consentGivenAt: null,
      consentVersion: null,
      consentWithdrawnAt: null,
      retentionEndsAt: '2027-04-07',
    });
  });

  it('EC-36 phone y summary null y skills [] salen explícitos; alta 22:30Z → retención 2027-04-07', async () => {
    const created = await createCandidate(app, {
      fullName: 'Ángel Vidal Mora',
      email: 'angel.vidal@example.com',
    });

    const body = (await getCandidate(created.id)).json<Record<string, unknown>>();

    expect(body.phone).toBeNull();
    expect(body.summary).toBeNull();
    expect(body.skills).toEqual([]);
    expect(body.retentionEndsAt).toBe('2027-04-07');
  });

  it('EC-40 el HTML se devuelve literal, sin sanear', async () => {
    const summary = '<script>alert("x")</script> y <b>negrita</b>';
    const created = await createCandidate(app, {
      fullName: '<i>x</i>',
      email: 'html.literal@example.com',
      summary,
      skills: ['<b>'],
    });

    const body = (await getCandidate(created.id)).json<Record<string, unknown>>();

    expect(body).toMatchObject({ fullName: '<i>x</i>', summary, skills: ['<b>'] });
  });
});

describe('GET /api/candidates/:id — errores', () => {
  it('CA-23 un ID inexistente → 404 NOT_FOUND sin datos', async () => {
    const response = await getCandidate(9999);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'El candidato no existe.' },
    });
  });

  it.each(['abc', '1.5'])('EC-35 el ID «%s» → 400 en id', async (id) => {
    const response = await getCandidate(id);

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(response.json().error.details).toEqual([{ field: 'id', message: 'Formato no válido.' }]);
  });

  it('RNF-05 DELETE /api/candidates/:id no existe → 404 «El recurso no existe.»', async () => {
    const created = await createCandidate(app, {
      fullName: 'Ana Gil',
      email: 'ana.gil@example.com',
    });

    const response = await app.inject({ method: 'DELETE', url: `/api/candidates/${created.id}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'El recurso no existe.' },
    });
    expect((await getCandidate(created.id)).statusCode).toBe(200);
  });
});
