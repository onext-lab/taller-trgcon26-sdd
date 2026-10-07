import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type { Application, Stage } from '../../src/modules/applications/schemas.ts';
import type { JobApplicationsPort } from '../../src/modules/jobs/applications-port.ts';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';
import { insertApplicationAt } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  closeJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
  failWrites,
  type TestClock,
} from '../helpers/test-app.ts';

// HU-06 TASK-04 [adversarial] (CA-06, EC-03, EC-08, EC-10, EC-14, EC-16..EC-19): el cierre con el puerto real frente a
// fallos de escritura, entradas hostiles y concurrencia. Datos inventados. Los triggers `failWrites` se instalan
// después de preparar los datos (inscribir y avanzar también escriben `stage_changes` y la retención).
const PUBLISH_AT = '2026-10-05T08:00:00.000Z';
const START_AT = '2026-10-05T09:00:00.000Z';
const CLOSED_AT = '2026-10-06T22:30:00.000Z';
const INTERNAL_ERROR = {
  error: { code: 'INTERNAL_ERROR', message: 'Error interno. Inténtalo de nuevo.' },
};
const INVALID_ID = {
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Hay campos con errores.',
    details: [{ field: 'id', message: 'Formato no válido.' }],
  },
};

let app: FastifyInstance;
let db: DatabaseSync;
let clock: TestClock;
let job: Job;
let candidateCount = 0;

async function start(jobApplications?: JobApplicationsPort): Promise<void> {
  clock = createTestClock(PUBLISH_AT);
  ({ app, db } = createTestApp({ now: clock.now, jobApplications }));
  job = await createPublishedJob(app);
}

beforeEach(() => start());

afterEach(async () => {
  await app.close();
});

interface Seeded {
  application: Application;
  candidate: Candidate;
}

/** Candidata sin consentimiento (con retención desde el alta) y su inscripción escrita por SQL en `path`. */
async function seedAt(jobId: number, path: Stage[] = ['received']): Promise<Seeded> {
  candidateCount += 1;
  const candidate = await createCandidate(app, {
    fullName: `Candidata Inventada ${candidateCount}`,
    email: `candidata.adversarial.${candidateCount}@example.com`,
    phone: `+34 600 000 ${String(candidateCount).padStart(3, '0')}`,
    consent: false,
  });
  const application = insertApplicationAt(db, {
    jobId,
    candidateId: candidate.id,
    path,
    startAt: START_AT,
  });
  return { application, candidate };
}

const getJob = async (id: number) =>
  (await app.inject({ method: 'GET', url: `/api/jobs/${id}` })).json<Job>();
const postClose = (id: number | string, headers?: Record<string, string>) =>
  app.inject({ method: 'POST', url: `/api/jobs/${id}/close`, ...(headers ? { headers } : {}) });

function count(table: 'stage_changes' | 'applications', where = '1 = 1'): number {
  return Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get()?.n);
}

/** Foto del estado observable: etapa y `lastChangeAt` de cada inscripción, historial y retención de cada candidato. */
async function snapshot(seeded: Seeded[]) {
  const repository = createApplicationsRepository(db);
  const rows = seeded.map(({ application }) => repository.findById(application.id));
  const retentions: (string | null)[] = [];
  for (const { candidate } of seeded) {
    const read = await app.inject({ method: 'GET', url: `/api/candidates/${candidate.id}` });
    retentions.push(read.json<Candidate>().retentionEndsAt);
  }
  return {
    applications: rows.map((row) => row && { stage: row.stage, lastChangeAt: row.lastChangeAt }),
    stageChanges: count('stage_changes'),
    jobClosedChanges: count('stage_changes', "reason = 'job_closed'"),
    retentions,
  };
}

function expectGeneric500(response: { statusCode: number; body: string; json: () => unknown }) {
  expect(response.statusCode).toBe(500);
  expect(response.json()).toEqual(INTERNAL_ERROR);
  for (const text of ['stack', 'SQLITE', 'fallo simulado', 'example.com', '600 000']) {
    expect(response.body).not.toContain(text);
  }
}

type FailAtSecond = (second: Seeded) => void;

const FAILURE_POINTS: [string, FailAtSecond][] = [
  [
    'UPDATE de applications',
    ({ application }) =>
      failWrites(db, 'UPDATE', {
        table: 'applications',
        whenNew: { column: 'id', equals: application.id },
      }),
  ],
  [
    'INSERT de stage_changes',
    ({ application }) =>
      failWrites(db, 'INSERT', {
        table: 'stage_changes',
        whenNew: { column: 'application_id', equals: application.id },
      }),
  ],
  [
    'UPDATE de retention_ends_at',
    ({ candidate }) =>
      failWrites(db, 'UPDATE', {
        table: 'candidates',
        column: 'retention_ends_at',
        whenNew: { column: 'id', equals: candidate.id },
      }),
  ],
];

describe('POST /api/jobs/:id/close — fallo en mitad del rechazo (CA-06, EC-03)', () => {
  it.each(FAILURE_POINTS)(
    'CA-06/EC-03 falla %s en la 2.ª de 3 → 500 y nada cambia',
    async (_name, failAtSecond) => {
      const all = [await seedAt(job.id), await seedAt(job.id), await seedAt(job.id)];
      const before = await snapshot(all);
      const jobBefore = await getJob(job.id);
      failAtSecond(all[1] as Seeded);
      clock.set(CLOSED_AT);

      const response = await postClose(job.id);

      expectGeneric500(response);
      expect(await getJob(job.id)).toEqual(jobBefore);
      expect(await getJob(job.id)).toMatchObject({ status: 'published', closedAt: null });
      expect(await snapshot(all)).toEqual(before);
      expect(before.applications.map((a) => a?.stage)).toEqual([
        'received',
        'received',
        'received',
      ]);
      expect(count('stage_changes', "reason = 'job_closed'")).toBe(0);
    },
  );

  it.each([[1.5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'whenNew.equals = %s no entero → lanza antes de ejecutar DDL',
    (equals) => {
      expect(() =>
        failWrites(db, 'UPDATE', { table: 'applications', whenNew: { column: 'id', equals } }),
      ).toThrow('whenNew.equals');
      const triggers = db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'fail_%'").all();
      expect(triggers).toEqual([]);
    },
  );
});

describe('POST /api/jobs/:id/close — entrada hostil (EC-08, EC-14, EC-19)', () => {
  it('EC-08/EC-14 id 1.5 o con cuerpo → 400 y nada rechazado', async () => {
    const all = [await seedAt(job.id), await seedAt(job.id, ['received', 'screening'])];
    const before = await snapshot(all);

    const preview = await app.inject({ method: 'GET', url: '/api/jobs/1.5/close-preview' });
    const badId = await postClose('1.5');
    const withBody = await app.inject({
      method: 'POST',
      url: `/api/jobs/${job.id}/close`,
      payload: { status: 'closed' },
    });

    expect(preview.statusCode).toBe(400);
    expect(preview.json()).toEqual(INVALID_ID);
    expect(badId.statusCode).toBe(400);
    expect(badId.json()).toEqual(INVALID_ID);
    expect(withBody.statusCode).toBe(400);
    expect(withBody.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(await getJob(job.id)).toMatchObject({ status: 'published', closedAt: null });
    expect(await snapshot(all)).toEqual(before);
  });

  it('EC-19 Sec-Fetch-Site cross-site → 403 y nada rechazado', async () => {
    const all = [await seedAt(job.id), await seedAt(job.id)];
    const before = await snapshot(all);
    clock.set(CLOSED_AT);

    const response = await postClose(job.id, { 'sec-fetch-site': 'cross-site' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: { code: 'CROSS_SITE_REQUEST', message: 'Petición no permitida desde otro sitio.' },
    });
    expect(await getJob(job.id)).toMatchObject({ status: 'published', closedAt: null });
    expect(await snapshot(all)).toEqual(before);
  });
});

describe('cierre — fallos de dependencia, concurrencia y datos legacy (EC-10, EC-16, EC-17, EC-18)', () => {
  it('EC-10 el recuento lanza → 500 INTERNAL_ERROR sin datos', async () => {
    await app.close();
    await start({
      countActiveApplications: () => {
        throw new Error('fallo simulado del recuento');
      },
      rejectActiveApplications: () => 0,
    });

    const response = await app.inject({ method: 'GET', url: `/api/jobs/${job.id}/close-preview` });

    expectGeneric500(response);
  });

  it('EC-16 falla el UPDATE de job_openings → 500 y ninguna inscripción cambia', async () => {
    const all = [await seedAt(job.id), await seedAt(job.id)];
    const before = await snapshot(all);
    failWrites(db, 'UPDATE');
    clock.set(CLOSED_AT);

    const response = await postClose(job.id);

    expectGeneric500(response);
    expect(await getJob(job.id)).toMatchObject({ status: 'published', closedAt: null });
    expect(await snapshot(all)).toEqual(before);
  });

  it('EC-17 dos cierres a la vez → un closedAt y StageChange solo del primero', async () => {
    const all = [
      await seedAt(job.id),
      await seedAt(job.id),
      await seedAt(job.id, ['received', 'screening']),
    ];
    const changesBefore = count('stage_changes');
    clock.set(CLOSED_AT);

    const [first, second] = await Promise.all([postClose(job.id), postClose(job.id)]);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json<Job>().closedAt).toBe(CLOSED_AT);
    expect(second.json<Job>().closedAt).toBe(first.json<Job>().closedAt);
    expect(count('stage_changes', "reason = 'job_closed'")).toBe(all.length);
    expect(count('stage_changes')).toBe(changesBefore + all.length);
    for (const { application } of all) {
      expect(
        count('stage_changes', `application_id = ${application.id} AND reason = 'job_closed'`),
      ).toBe(1);
    }
  });

  it('EC-18 closed con activas escritas por SQL → POST /close no-op', async () => {
    clock.set(CLOSED_AT);
    const closed = await closeJob(app, job.id);
    const legacy = await seedAt(job.id, ['received', 'screening', 'interview']);
    const before = await snapshot([legacy]);
    clock.advance(60 * 60 * 1000);

    const response = await postClose(job.id);

    expect(response.statusCode).toBe(200);
    expect(response.json<Job>()).toEqual(closed);
    expect(response.json<Job>().closedAt).toBe(CLOSED_AT);
    expect(await snapshot([legacy])).toEqual(before);
    expect(before.applications).toEqual([
      { stage: 'interview', lastChangeAt: expect.any(String) as string },
    ]);
    expect(count('stage_changes', "reason = 'job_closed'")).toBe(0);
  });
});
