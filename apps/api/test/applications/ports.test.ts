import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertApplicationWithHistory, type SeedStep } from '../../src/db/seed-applications.ts';
import { createCandidateProcessesReader } from '../../src/modules/applications/candidate-processes.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import { createCandidatesRepository } from '../../src/modules/candidates/repository.ts';
import { createCandidatesService } from '../../src/modules/candidates/service.ts';
import { noCandidateProcesses } from '../../src/modules/candidates/processes-port.ts';
import { createJobStatusReader } from '../../src/modules/jobs/job-status.ts';
import { createJobsRepository } from '../../src/modules/jobs/repository.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  closeJob,
  createJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
} from '../helpers/test-app.ts';

// Datos inventados. Reloj fijo: alta y consentimiento caen el 2026-10-07 (Madrid).
const NOW = '2026-10-07T10:00:00.000Z';
const OPEN_STEPS: SeedStep[] = [
  { stage: 'received', at: '2026-10-01T09:00:00.000Z' },
  { stage: 'screening', at: '2026-10-02T09:00:00.000Z' },
];
const REJECTED_AT = '2026-09-01T09:00:00.000Z';
const HIRED_AT = '2026-09-20T09:00:00.000Z';

let app: FastifyInstance;
let db: DatabaseSync;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW).now }));
});

afterEach(async () => {
  await app.close();
});

let sequence = 0;
async function newCandidate(consent = false): Promise<number> {
  sequence += 1;
  const candidate = await createCandidate(app, {
    fullName: `Candidata Inventada ${sequence}`,
    email: `candidata.${sequence}@example.com`,
    consent,
  });
  return candidate.id;
}

async function newJob(): Promise<number> {
  sequence += 1;
  return (await createPublishedJob(app, { title: `Oferta inventada ${sequence}` })).id;
}

function rejectedSteps(at: string): SeedStep[] {
  return [
    { stage: 'received', at: '2026-08-01T09:00:00.000Z' },
    { stage: 'rejected', at, reason: 'not_a_fit', note: 'Nota inventada.' },
  ];
}

function hiredSteps(at: string): SeedStep[] {
  return [
    { stage: 'received', at: '2026-08-01T09:00:00.000Z' },
    { stage: 'screening', at: '2026-08-05T09:00:00.000Z' },
    { stage: 'interview', at: '2026-08-10T09:00:00.000Z' },
    { stage: 'offer', at: '2026-08-15T09:00:00.000Z' },
    { stage: 'hired', at },
  ];
}

async function enroll(candidateId: number, steps: SeedStep[]): Promise<void> {
  const jobId = await newJob();
  insertApplicationWithHistory(createApplicationsRepository(db), { candidateId, jobId, steps });
}

function processesOf(candidateId: number) {
  return createCandidateProcessesReader(createApplicationsRepository(db)).getProcesses(candidateId);
}

async function renewConsent(candidateId: number) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/candidates/${candidateId}/consent`,
  });
  return response.json<{ retentionEndsAt: string | null }>();
}

describe('puerto de procesos real en buildApp', () => {
  it('CA-20 con una inscripción abierta: true/true y la retención pasa a null', async () => {
    const candidateId = await newCandidate(true);
    await enroll(candidateId, OPEN_STEPS);

    expect(processesOf(candidateId)).toEqual({
      hasOpenApplication: true,
      hadAnyApplication: true,
      lastProcessClosedAt: null,
    });
    expect((await renewConsent(candidateId)).retentionEndsAt).toBeNull();
  });

  it('CA-20 sin inscripciones: false/false/null y la retención conserva su fecha', async () => {
    const candidateId = await newCandidate(true);
    const before = (await renewConsent(candidateId)).retentionEndsAt;

    expect(processesOf(candidateId)).toEqual({
      hasOpenApplication: false,
      hadAnyApplication: false,
      lastProcessClosedAt: null,
    });
    expect(before).toBe('2028-10-07');
    expect((await renewConsent(candidateId)).retentionEndsAt).toBe(before);
  });

  it('CA-20 con el lector real y sin inscripciones responde lo mismo que noCandidateProcesses', async () => {
    const candidateId = await newCandidate();

    expect(processesOf(candidateId)).toEqual(noCandidateProcesses.getProcesses(candidateId));
  });
});

describe('lector de procesos', () => {
  it('EC-21 sin inscripciones: 0, 0 y null', async () => {
    const candidateId = await newCandidate();

    expect(createApplicationsRepository(db).getProcessFacts(candidateId)).toEqual({
      total: 0,
      open: 0,
      lastClosedAt: null,
    });
    expect(processesOf(candidateId).lastProcessClosedAt).toBeNull();
  });

  it('EC-21 una abierta: hasOpen y sin fecha de cierre', async () => {
    const candidateId = await newCandidate();
    await enroll(candidateId, OPEN_STEPS);

    expect(processesOf(candidateId)).toEqual({
      hasOpenApplication: true,
      hadAnyApplication: true,
      lastProcessClosedAt: null,
    });
  });

  it('EC-21 dos finales de fechas distintas: gana la más reciente', async () => {
    const candidateId = await newCandidate();
    await enroll(candidateId, rejectedSteps(REJECTED_AT));
    await enroll(candidateId, hiredSteps(HIRED_AT));

    expect(processesOf(candidateId)).toEqual({
      hasOpenApplication: false,
      hadAnyApplication: true,
      lastProcessClosedAt: HIRED_AT,
    });
  });

  it('EC-21 una final y otra abierta: hasOpen y lastProcessClosedAt null', async () => {
    const candidateId = await newCandidate();
    await enroll(candidateId, rejectedSteps(REJECTED_AT));
    await enroll(candidateId, OPEN_STEPS);

    expect(processesOf(candidateId)).toEqual({
      hasOpenApplication: true,
      hadAnyApplication: true,
      lastProcessClosedAt: null,
    });
  });

  it('EC-21 solo cuenta las inscripciones del candidato pedido', async () => {
    const [one, other] = [await newCandidate(), await newCandidate()];
    await enroll(other, OPEN_STEPS);

    expect(processesOf(one).hadAnyApplication).toBe(false);
  });

  it('EC-25 dos llamadas seguidas: mismo resultado y total_changes igual', async () => {
    const candidateId = await newCandidate();
    await enroll(candidateId, rejectedSteps(REJECTED_AT));
    const changes = (): unknown => db.prepare('SELECT total_changes() AS n').get()?.n;
    const before = changes();

    const first = processesOf(candidateId);
    const second = processesOf(candidateId);

    expect(second).toEqual(first);
    expect(changes()).toBe(before);
  });
});

describe('lectura del estado de la oferta', () => {
  it('devuelve draft, published y closed, y null si la oferta no existe', async () => {
    const reader = createJobStatusReader(createJobsRepository(db));
    const draft = await createJob(app, { title: 'Borrador inventado' });
    const published = await createPublishedJob(app, { title: 'Publicada inventada' });
    const closed = await createPublishedJob(app, { title: 'Cerrada inventada' });
    await closeJob(app, closed.id);

    expect(reader.getJobStatus(draft.id)).toBe('draft');
    expect(reader.getJobStatus(published.id)).toBe('published');
    expect(reader.getJobStatus(closed.id)).toBe('closed');
    expect(reader.getJobStatus(9999)).toBeNull();
  });

  it('DT-07 lector real: getJobSummary → status y title; inexistente → null', async () => {
    const reader = createJobStatusReader(createJobsRepository(db));
    const draft = await createJob(app, { title: 'Borrador inventado' });
    const published = await createPublishedJob(app, { title: 'Publicada inventada' });
    const closed = await createPublishedJob(app, { title: 'Cerrada inventada' });
    await closeJob(app, closed.id);

    expect(reader.getJobSummary(draft.id)).toEqual({
      status: 'draft',
      title: 'Borrador inventado',
    });
    expect(reader.getJobSummary(published.id)).toEqual({
      status: 'published',
      title: 'Publicada inventada',
    });
    expect(reader.getJobSummary(closed.id)).toEqual({
      status: 'closed',
      title: 'Cerrada inventada',
    });
    expect(reader.getJobSummary(9999)).toBeNull();
  });

  it('HU-07 lector real: getEnrollmentDeadline → fecha, null sin plazo, null si no existe', async () => {
    const reader = createJobStatusReader(createJobsRepository(db));
    const withDeadline = await createJob(app, {
      title: 'Con plazo inventado',
      enrollmentDeadline: '2026-10-20',
    });
    const withoutDeadline = await createJob(app, { title: 'Sin plazo inventado' });

    expect(reader.getEnrollmentDeadline(withDeadline.id)).toBe('2026-10-20');
    expect(reader.getEnrollmentDeadline(withoutDeadline.id)).toBeNull();
    expect(reader.getEnrollmentDeadline(9999)).toBeNull();
  });
});

describe('lecturas de candidates para applications', () => {
  function candidatesService() {
    return createCandidatesService({
      repository: createCandidatesRepository(db),
      now: createTestClock(NOW).now,
      transaction: (fn) => fn(),
      processes: noCandidateProcesses,
    });
  }

  it('exists distingue una ficha existente de otra que no existe', async () => {
    const candidateId = await newCandidate();

    expect(candidatesService().exists(candidateId)).toBe(true);
    expect(candidatesService().exists(candidateId + 1000)).toBe(false);
  });

  it('findNames devuelve solo id y nombre; un ID inexistente no sale en el Map', async () => {
    const [one, two] = [await newCandidate(), await newCandidate()];

    const names = candidatesService().findNames([one, two, 9999]);

    expect([...names.keys()].sort()).toEqual([one, two].sort());
    expect(names.get(one)).toMatch(/^Candidata Inventada \d+$/);
    expect(names.has(9999)).toBe(false);
  });

  it('findNames([]) devuelve un Map vacío sin consultar', () => {
    const service = createCandidatesService({
      repository: {
        ...createCandidatesRepository(db),
        findNamesByIds: () => {
          throw new Error('no debía consultar');
        },
      },
      now: createTestClock(NOW).now,
      transaction: (fn) => fn(),
      processes: noCandidateProcesses,
    });

    expect(service.findNames([]).size).toBe(0);
  });
});
