import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Candidate } from '../../src/modules/candidates/schemas.ts';
import { enroll } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import { createPublishedJob, createTestApp, createTestClock } from '../helpers/test-app.ts';

// Datos inventados. Alta el 2026-01-10: sin inscripción ni consentimiento caduca el 2026-07-10.
const CREATED = '2026-01-10T10:00:00.000Z';
const LATER = '2026-10-07T10:00:00.000Z';

let app: FastifyInstance;
let clock: ReturnType<typeof createTestClock>;

beforeEach(() => {
  clock = createTestClock(CREATED);
  ({ app } = createTestApp({ now: clock.now }));
});

afterEach(async () => {
  await app.close();
});

function newCandidate(consent: boolean): Promise<Candidate> {
  return createCandidate(app, {
    fullName: 'Candidata Inventada',
    email: 'candidata.retencion@example.com',
    consent,
  });
}

async function retentionOf(candidateId: number): Promise<string | null> {
  const response = await app.inject({ method: 'GET', url: `/api/candidates/${candidateId}` });
  return response.json<Candidate>().retentionEndsAt;
}

describe('POST /api/applications — retención (RF-03)', () => {
  it('EC-08 retención vencida (reloj adelantado) → 201 y retentionEndsAt null', async () => {
    const job = await createPublishedJob(app);
    const candidate = await newCandidate(false);
    expect(await retentionOf(candidate.id)).toBe('2026-07-10');
    clock.set(LATER);

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(201);
    expect(await retentionOf(candidate.id)).toBeNull();
  });

  it('EC-23 consentimiento vigente + inscripción → null (la inscripción abierta prevalece)', async () => {
    const job = await createPublishedJob(app);
    const candidate = await newCandidate(true);
    expect(await retentionOf(candidate.id)).toBe('2028-01-10');

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(201);
    expect(await retentionOf(candidate.id)).toBeNull();
  });

  it('EC-53 consentimiento retirado + inscripción → null', async () => {
    const job = await createPublishedJob(app);
    const candidate = await newCandidate(true);
    const withdrawal = await app.inject({
      method: 'POST',
      url: `/api/candidates/${candidate.id}/consent/withdrawal`,
    });
    expect(withdrawal.statusCode).toBe(200);
    expect(await retentionOf(candidate.id)).toBe('2026-07-10');

    const response = await enroll(app, job.id, candidate.id);

    expect(response.statusCode).toBe(201);
    expect(await retentionOf(candidate.id)).toBeNull();
  });
});
