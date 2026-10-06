import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CandidateProcessesPort } from '../../src/modules/candidates/processes-port.ts';
import { computeRetentionEndsAt } from '../../src/modules/candidates/retention.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { createCandidate, createProcessesStub } from '../helpers/candidates.ts';
import { createTestApp, createTestClock, failWrites, type TestClock } from '../helpers/test-app.ts';

// TASK-08 [adversarial]: cuerpos prohibidos, IDs hostiles, fallos y concurrencia en las acciones de consentimiento.
// Datos inventados. «Nada cambia» = la ficha de GET /api/candidates/:id es idéntica antes y después.
const CREATED = '2026-02-06T09:00:00.000Z';
const NOW = '2026-10-06T09:00:00.000Z';
const NO_BODY = 'Esta acción no admite cuerpo.';
const GENERIC_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};

let app: FastifyInstance;
let db: DatabaseSync;
let clock: TestClock;
let failProcesses = false;

/** Puerto que delega en un doble que falla (EC-53) solo cuando `failProcesses` está activo: el alta previa pasa. */
const togglingPort: CandidateProcessesPort = {
  getProcesses(id) {
    const stub = createProcessesStub({ fail: failProcesses });
    return stub.getProcesses(id);
  },
};

beforeEach(() => {
  failProcesses = false;
  clock = createTestClock(CREATED);
  ({ app, db } = createTestApp({ now: clock.now, candidateProcesses: togglingPort }));
});

afterEach(async () => {
  await app.close();
});

type Action = 'consent' | 'consent/withdrawal';
const ACTIONS: Action[] = ['consent', 'consent/withdrawal'];

function act(id: number | string, action: Action, extra: object = {}) {
  return app.inject({ method: 'POST', url: `/api/candidates/${id}/${action}`, ...extra });
}

async function readCandidate(id: number): Promise<Candidate> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${id}` });
  return response.json<Candidate>();
}

/** Candidato inventado con consentimiento vigente (alta con `consent: true`) y el reloj ya en `NOW`. */
async function seedWithConsent(): Promise<Candidate> {
  const created = await createCandidate(app, {
    fullName: 'Lucía Ferrer Soler',
    email: 'lucia.ferrer@example.com',
    phone: '600 000 001',
    summary: 'Resumen inventado',
    consent: true,
  });
  clock.set(NOW);
  return created;
}

function expectNoPersonalData(response: LightMyRequestResponse): void {
  for (const text of [
    'lucia',
    'Lucía',
    'Ferrer',
    '600 000',
    'Resumen',
    'stack',
    'SQLITE',
    'fallo',
  ]) {
    expect(response.body).not.toContain(text);
  }
}

describe('POST …/consent y …/consent/withdrawal — cuerpo prohibido e ID inválido (EC-42)', () => {
  it.each(
    ACTIONS.flatMap((action) => [
      [action, { consentGivenAt: NOW }] as const,
      [action, {}] as const,
    ]),
  )('EC-42 POST …/%s con cuerpo %j → 400 en body y la ficha no cambia', async (action, payload) => {
    const created = await seedWithConsent();
    const before = await readCandidate(created.id);

    const response = await act(created.id, action, { payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        details: [{ field: 'body', message: NO_BODY }],
      },
    });
    expect(response.body).not.toContain(NOW);
    expect(await readCandidate(created.id)).toEqual(before);
  });

  it.each(
    ACTIONS.flatMap((action) => ['abc', '0', '-1', '1.5'].map((id) => [action, id] as const)),
  )('EC-42 POST …/%s con ID %s → 400 en id', async (action, id) => {
    const created = await seedWithConsent();
    const before = await readCandidate(created.id);

    const response = await act(id, action);

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { details: unknown } }>().error.details).toEqual([
      { field: 'id', message: 'Formato no válido.' },
    ]);
    expect(await readCandidate(created.id)).toEqual(before);
  });

  it.each(ACTIONS)(
    'EC-42 POST …/%s con ID inválido y cuerpo → details solo con body',
    async (action) => {
      const response = await act('abc', action, { payload: {} });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ error: { details: unknown } }>().error.details).toEqual([
        { field: 'body', message: NO_BODY },
      ]);
    },
  );
});

describe('POST …/consent y …/consent/withdrawal — ID inexistente (CA-29, EC-48)', () => {
  it.each(ACTIONS)('CA-29/EC-48 POST …/%s con ID 999999 → 404 sin datos', async (action) => {
    await seedWithConsent();

    const response = await act(999999, action);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'El candidato no existe.' },
    });
    expectNoPersonalData(response);
  });
});

describe('POST …/consent y …/consent/withdrawal — fallo en el recálculo (CA-30, EC-45, EC-53, EC-56)', () => {
  it.each(ACTIONS)(
    'CA-30/EC-45 fallo de SQLite al guardar la retención en …/%s → 500 y ROLLBACK de consentimiento y retención',
    async (action) => {
      const created = await seedWithConsent();
      const before = await readCandidate(created.id);
      failWrites(db, 'UPDATE', { table: 'candidates', column: 'retention_ends_at' });

      const response = await act(created.id, action);

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual(GENERIC_ERROR);
      expectNoPersonalData(response);
      expect(await readCandidate(created.id)).toEqual(before);
    },
  );

  it.each(ACTIONS)(
    'EC-53 fallo del puerto de procesos en …/%s → 500 y nada cambia',
    async (action) => {
      const created = await seedWithConsent();
      const before = await readCandidate(created.id);
      failProcesses = true;

      const response = await act(created.id, action);

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual(GENERIC_ERROR);
      expectNoPersonalData(response);
      expect(await readCandidate(created.id)).toEqual(before);
    },
  );

  it('EC-45 registrar sobre un candidato sin consentimiento con fallo en la retención → sigue sin consentimiento', async () => {
    const created = await createCandidate(app, {
      fullName: 'Ana Gil',
      email: 'ana.gil@example.com',
    });
    clock.set(NOW);
    failWrites(db, 'UPDATE', { table: 'candidates', column: 'retention_ends_at' });

    const response = await act(created.id, 'consent');

    expect(response.statusCode).toBe(500);
    const after = await readCandidate(created.id);
    expect(after).toEqual(created);
    expect(after).toMatchObject({ consentGivenAt: null, consentWithdrawnAt: null });
  });
});

describe('POST …/consent y …/consent/withdrawal — concurrencia (EC-46)', () => {
  it('EC-46 retirar y renovar a la vez → estado de una de las dos y retención de la fórmula (INV-03)', async () => {
    const created = await seedWithConsent();

    const responses = await Promise.all([
      act(created.id, 'consent/withdrawal'),
      act(created.id, 'consent'),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    const final = await readCandidate(created.id);
    const withdrawn = final.consentWithdrawnAt !== null;
    expect(final.consentGivenAt).not.toBeNull();
    expect(final.consentWithdrawnAt).toEqual(withdrawn ? NOW : null);
    expect(final.retentionEndsAt).toBe(
      computeRetentionEndsAt({
        createdAt: final.createdAt,
        consentGivenAt: final.consentGivenAt,
        consentWithdrawnAt: final.consentWithdrawnAt,
        processes: togglingPort.getProcesses(final.id),
      }),
    );
  });
});

describe('POST …/consent y …/consent/withdrawal — escrituras entre sitios (DEC-12)', () => {
  it.each(['cross-site', 'same-site'])(
    'DEC-12 POST …/consent/withdrawal con Sec-Fetch-Site %s → 403 CROSS_SITE_REQUEST y nada cambia',
    async (site) => {
      const created = await seedWithConsent();
      const before = await readCandidate(created.id);

      const response = await act(created.id, 'consent/withdrawal', {
        headers: { 'sec-fetch-site': site },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: { code: 'CROSS_SITE_REQUEST', message: 'Petición no permitida desde otro sitio.' },
      });
      expect(await readCandidate(created.id)).toEqual(before);
    },
  );
});
