import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTransaction } from '../../src/db/transaction.ts';
import { AppError } from '../../src/errors.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { Application, Stage } from '../../src/modules/applications/schemas.ts';
import { createApplicationsService } from '../../src/modules/applications/service.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import {
  advance,
  createJobStatusStub,
  insertApplicationAt,
  reject,
} from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  createPublishedJob,
  createTestApp,
  createTestClock,
  failWrites,
  type FailWritesTarget,
  type WriteOperation,
} from '../helpers/test-app.ts';

// TASK-07 [adversarial] (CA-11, CA-20, EC-05, EC-14, DD-02): un fallo en cada escritura de avanzar y de rechazar deja
// todo como estaba (DEC-06), y la guarda del `UPDATE` rechaza una etapa desfasada. Datos inventados. Los triggers
// `failWrites` se crean después de preparar candidato, oferta e inscripción.
const START_AT = '2026-10-01T09:00:00.000Z';
const NOW = '2026-10-07T10:00:00.000Z';
const GENERIC_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};

let app: FastifyInstance;
let db: DatabaseSync;
let jobId: number;

beforeEach(async () => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
  jobId = (await createPublishedJob(app)).id;
});

afterEach(async () => {
  await app.close();
});

interface Seeded {
  application: Application;
  candidate: Candidate;
}

/** Candidata sin consentimiento (con `retentionEndsAt` desde el alta), ya en la última etapa de `path`. */
async function seedAt(...path: Stage[]): Promise<Seeded> {
  const candidate = await createCandidate(app, {
    fullName: 'Candidata Inventada',
    email: 'candidata.fallos.etapa@example.com',
    phone: '+34 600 000 031',
    consent: false,
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

/** Foto del estado observable: inscripción (etapa y `lastChangeAt`), historial y retención del candidato. */
async function snapshot({ application, candidate }: Seeded) {
  const read = await app.inject({ method: 'GET', url: `/api/candidates/${candidate.id}` });
  return {
    application: createApplicationsRepository(db).findById(application.id),
    history: history(application.id),
    retention: read.json<Candidate>().retentionEndsAt,
  };
}

function expectGeneric500(
  response: { statusCode: number; body: string; json: () => unknown },
  { candidate }: Seeded,
): void {
  expect(response.statusCode).toBe(500);
  expect(response.json()).toEqual(GENERIC_ERROR);
  for (const text of ['stack', 'SQLITE', 'fallo simulado', candidate.email, candidate.fullName]) {
    expect(response.body).not.toContain(text);
  }
  expect(response.body).not.toContain('600 000');
}

interface WriteFailure {
  name: string;
  op: WriteOperation;
  target: FailWritesTarget;
}

const WRITE_FAILURES: WriteFailure[] = [
  { name: 'UPDATE de applications', op: 'UPDATE', target: { table: 'applications' } },
  { name: 'INSERT de stage_changes', op: 'INSERT', target: { table: 'stage_changes' } },
  {
    name: 'UPDATE de retention_ends_at',
    op: 'UPDATE',
    target: { table: 'candidates', column: 'retention_ends_at' },
  },
];

describe('POST /api/applications/:id/advance — fallos de escritura (EC-05, EC-14)', () => {
  it.each(WRITE_FAILURES)(
    'CA-11 fallo en $name al contratar → 500 y nada cambia',
    async ({ op, target }) => {
      const seeded = await seedAt('screening', 'interview', 'offer');
      const before = await snapshot(seeded);
      failWrites(db, op, target);

      const response = await advance(app, seeded.application.id, {
        expectedStage: 'offer',
        toStage: 'hired',
      });

      expectGeneric500(response, seeded);
      expect(await snapshot(seeded)).toEqual(before);
    },
  );
});

describe('POST /api/applications/:id/reject — fallos de escritura (EC-05, EC-14)', () => {
  it.each(WRITE_FAILURES)(
    'CA-20 fallo en $name al rechazar → 500 y nada cambia',
    async ({ op, target }) => {
      const seeded = await seedAt('screening');
      const before = await snapshot(seeded);
      failWrites(db, op, target);

      const response = await reject(app, seeded.application.id, {
        expectedStage: 'screening',
        reason: 'not_a_fit',
        note: 'Nota inventada de prueba.',
      });

      expectGeneric500(response, seeded);
      expect(response.body).not.toContain('Nota inventada');
      expect(await snapshot(seeded)).toEqual(before);
    },
  );
});

describe('applications service — guarda del UPDATE (DD-02)', () => {
  /** Servicio real sobre un repositorio real cuyo `findById` devuelve la etapa anterior a la guardada. */
  function staleService(staleStage: Stage) {
    const repository = createApplicationsRepository(db);
    return createApplicationsService({
      repository: {
        ...repository,
        findById: (id) => {
          const found = repository.findById(id);
          return found && { ...found, stage: staleStage };
        },
      },
      now: createTestClock(NOW).now,
      transaction: (fn) => withTransaction(db, fn),
      jobStatus: createJobStatusStub(),
      candidates: { exists: () => true, findNames: () => new Map() },
      recalculateRetention: () => undefined,
    });
  }

  function thrownBy(call: () => unknown): AppError {
    try {
      call();
    } catch (error) {
      if (error instanceof AppError) return error;
      throw error;
    }
    throw new Error('Se esperaba un AppError y no se lanzó nada');
  }

  it.each([
    {
      name: 'avance',
      call: (id: number) =>
        staleService('received').advance(id, { expectedStage: 'received', toStage: 'screening' }),
    },
    {
      name: 'rechazo',
      call: (id: number) =>
        staleService('received').reject(id, { expectedStage: 'received', reason: 'other' }),
    },
  ])('DD-02 findById desfasado → 409 STAGE_MISMATCH sin StageChange ($name)', async ({ call }) => {
    const seeded = await seedAt('screening');
    const before = await snapshot(seeded);

    const error = thrownBy(() => call(seeded.application.id));

    expect(error).toMatchObject({ code: 'STAGE_MISMATCH', statusCode: 409 });
    expect(await snapshot(seeded)).toEqual(before);
    expect(history(seeded.application.id)).toHaveLength(2);
  });
});
