import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seed } from '../../src/db/seed.ts';
import type { Stage } from '../../src/modules/applications/schemas.ts';
import { insertApplicationAt } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// HU-06 TASK-02: previa del cierre con el puerto real (sin `jobApplications`). Datos inventados; el seed se carga con
// un `now` fijo para que sus ofertas `draft` y `closed` sean reproducibles.
const NOW = new Date('2026-10-06T10:00:00.000Z');
const START_AT = '2026-10-06T10:30:00.000Z';

let app: FastifyInstance;
let db: DatabaseSync;
let candidateCount = 0;

beforeEach(() => {
  ({ app, db } = createTestApp({ now: createTestClock(NOW.toISOString()).now }));
  seed(db, NOW);
});

afterEach(async () => {
  await app.close();
});

async function addApplication(jobId: number, ...path: Stage[]): Promise<void> {
  candidateCount += 1;
  const candidate = await createCandidate(app, {
    fullName: `Candidata Inventada ${candidateCount}`,
    email: `candidata.previa.${candidateCount}@example.com`,
    phone: `+34 600 000 ${String(candidateCount).padStart(3, '0')}`,
    consent: false,
  });
  const reason = path.at(-1) === 'rejected' ? ({ reason: 'not_a_fit' } as const) : {};
  insertApplicationAt(db, { jobId, candidateId: candidate.id, path, startAt: START_AT, ...reason });
}

async function preview(jobId: number) {
  return app.inject({ method: 'GET', url: `/api/jobs/${jobId}/close-preview` });
}

function jobIdWithStatus(status: 'draft' | 'closed'): number {
  const row = db.prepare('SELECT id FROM job_openings WHERE status = ? ORDER BY id').get(status);
  return Number(row?.id);
}

describe('GET /api/jobs/:id/close-preview — recuento real de activas', () => {
  it('CA-08 previa: 6 etapas → 4, draft → 0, closed del seed → 0, solo activeApplications', async () => {
    const job = await createPublishedJob(app, { title: 'Oferta de la previa' });
    const counts: number[] = [];

    counts.push((await preview(job.id)).json<{ activeApplications: number }>().activeApplications);
    await addApplication(job.id, 'received');
    counts.push((await preview(job.id)).json<{ activeApplications: number }>().activeApplications);
    await addApplication(job.id, 'received', 'screening');
    await addApplication(job.id, 'received', 'screening', 'interview');
    await addApplication(job.id, 'received', 'screening', 'interview', 'offer');
    counts.push((await preview(job.id)).json<{ activeApplications: number }>().activeApplications);
    await addApplication(job.id, 'received', 'screening', 'interview', 'offer', 'hired');
    await addApplication(job.id, 'received', 'rejected');
    const sixStages = await preview(job.id);

    expect(counts).toEqual([0, 1, 4]);
    expect(sixStages.statusCode).toBe(200);
    expect(sixStages.json()).toEqual({ activeApplications: 4 });
    expect(Object.keys(sixStages.json())).toEqual(['activeApplications']);

    for (const status of ['draft', 'closed'] as const) {
      const response = await preview(jobIdWithStatus(status));
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ activeApplications: 0 });
    }
  });
});
