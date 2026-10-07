import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { CandidateProcessesPort } from '../../src/modules/candidates/processes-port.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { createJobStatusStub, enroll } from '../helpers/applications.ts';
import { createCandidate, createProcessesStub } from '../helpers/candidates.ts';
import {
  createPublishedJob,
  createTestApp,
  createTestClock,
  failWrites,
  type FailWritesTarget,
  type WriteOperation,
} from '../helpers/test-app.ts';

// TASK-08 [adversarial] (CA-11, EC-05, EC-18, EC-22, EC-52): un fallo en cada efecto de la transacción de inscribir
// deja todo como estaba (DEC-06). Datos inventados. El alta del candidato ya escribe `retention_ends_at`, así que los
// triggers `failWrites` se crean después de preparar candidato y oferta.
const CREATED = '2026-01-10T10:00:00.000Z';
const GENERIC_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};

let app: FastifyInstance;
let db: DatabaseSync;
let failProcesses = false;

/** Funciona en el alta del candidato y falla después, cuando `failProcesses` se activa (como en `consent-adversarial`). */
const togglingPort: CandidateProcessesPort = {
  getProcesses(id) {
    return createProcessesStub({ fail: failProcesses }).getProcesses(id);
  },
};

afterEach(async () => {
  failProcesses = false;
  await app.close();
});

function count(table: string): number {
  return Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n);
}

async function readCandidate(id: number): Promise<Candidate> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${id}` });
  return response.json<Candidate>();
}

/** Candidato sin consentimiento (alta con `retentionEndsAt` no nulo) y una oferta publicada. */
async function seed(options: Parameters<typeof createTestApp>[0] = {}) {
  ({ app, db } = createTestApp({ now: createTestClock(CREATED).now, ...options }));
  const job = await createPublishedJob(app);
  const candidate = await createCandidate(app, {
    fullName: 'Candidata Inventada',
    email: 'candidata.fallos@example.com',
    phone: '+34 600 000 011',
    consent: false,
  });
  return { job, candidate, before: await readCandidate(candidate.id) };
}

async function expectNothingChanged(
  before: Candidate,
  response: Awaited<ReturnType<typeof enroll>>,
): Promise<void> {
  expect(response.statusCode).toBe(500);
  expect(response.json()).toEqual(GENERIC_ERROR);
  expect(response.body).not.toContain('stack');
  expect(count('applications')).toBe(0);
  expect(count('stage_changes')).toBe(0);
  expect(await readCandidate(before.id)).toEqual(before);
}

describe('POST /api/applications — fallos de escritura (CA-11)', () => {
  const writes: { name: string; op: WriteOperation; target: FailWritesTarget }[] = [
    { name: 'EC-05 INSERT de applications', op: 'INSERT', target: { table: 'applications' } },
    { name: 'CA-11 INSERT de stage_changes', op: 'INSERT', target: { table: 'stage_changes' } },
    {
      name: 'EC-52 UPDATE de retention_ends_at',
      op: 'UPDATE',
      target: { table: 'candidates', column: 'retention_ends_at' },
    },
  ];

  it.each(writes)(
    '$name falla → 500 INTERNAL_ERROR sin stack, 0 inscripciones, 0 StageChange y la misma retentionEndsAt',
    async ({ op, target }) => {
      const { job, candidate, before } = await seed();
      expect(before.retentionEndsAt).not.toBeNull();
      failWrites(db, op, target);

      const response = await enroll(app, job.id, candidate.id);

      await expectNothingChanged(before, response);
    },
  );

  it('CA-11 tras un fallo, la misma inscripción se acepta cuando la causa desaparece (nada quedó a medias)', async () => {
    const { job, candidate } = await seed();
    failWrites(db, 'INSERT', { table: 'stage_changes' });
    expect((await enroll(app, job.id, candidate.id)).statusCode).toBe(500);
    db.exec('DROP TRIGGER fail_stage_changes_insert');

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(201);
    expect(count('applications')).toBe(1);
    expect(count('stage_changes')).toBe(1);
    expect((await readCandidate(candidate.id)).retentionEndsAt).toBeNull();
  });
});

describe('POST /api/applications — fallos de los puertos (EC-18, EC-22)', () => {
  it('EC-18 el puerto de estado lanza → 500 y 0 filas', async () => {
    const { job, candidate, before } = await seed({
      jobStatus: createJobStatusStub({ fail: true }),
    });

    const response = await enroll(app, job.id, candidate.id);

    await expectNothingChanged(before, response);
  });

  it('EC-22 el puerto de procesos falla durante el recálculo → 500 y 0 inscripciones y 0 StageChange', async () => {
    const { job, candidate, before } = await seed({ candidateProcesses: togglingPort });
    failProcesses = true;

    const response = await enroll(app, job.id, candidate.id);

    await expectNothingChanged(before, response);
  });
});
