import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { seed } from '../../src/db/seed.ts';
import { noCandidateProcesses } from '../../src/modules/candidates/processes-port.ts';
import {
  computeRetentionEndsAt,
  madridCalendarDate,
} from '../../src/modules/candidates/retention.ts';
import {
  candidateFieldsSchema,
  type Candidate,
  type CandidatePage,
} from '../../src/modules/candidates/schemas.ts';

// Datos inventados. `now` fijo: el seed resta días a `now` (DD-10).
const NOW = new Date('2026-10-06T10:00:00.000Z');
const SIMPLE_EMAIL = /^[a-z0-9]+(?:\.[a-z0-9]+)*@example\.com$/;

let app: FastifyInstance;

beforeEach(() => {
  const db = openDatabase(':memory:');
  migrate(db);
  seed(db, NOW);
  app = buildApp({ db });
});

afterEach(async () => {
  await app.close();
});

async function loadSeededCandidates(): Promise<Candidate[]> {
  const list = await app.inject({ method: 'GET', url: '/api/candidates?pageSize=100' });
  expect(list.statusCode).toBe(200);
  const page = list.json<CandidatePage>();
  expect(page.total).toBe(30);
  const candidates: Candidate[] = [];
  for (const item of page.items) {
    const response = await app.inject({ method: 'GET', url: `/api/candidates/${item.id}` });
    expect(response.statusCode).toBe(200);
    candidates.push(response.json<Candidate>());
  }
  return candidates;
}

describe('seed de candidatos — datos de ejemplo (RF-08)', () => {
  it('RF-08 migrate + seed → 30 candidatos: 10 vigentes, 4 retirados y 16 sin consentimiento', async () => {
    const candidates = await loadSeededCandidates();

    const current = candidates.filter((c) => c.consentGivenAt && !c.consentWithdrawnAt);
    const withdrawn = candidates.filter((c) => c.consentGivenAt && c.consentWithdrawnAt);
    const none = candidates.filter((c) => !c.consentGivenAt);
    expect([current.length, withdrawn.length, none.length]).toEqual([10, 4, 16]);
    for (const c of candidates.filter((c) => c.consentGivenAt)) {
      expect(c.consentVersion).toBe('v1');
    }
    for (const c of none) expect(c.consentVersion).toBeNull();
  });

  it('RF-08 todos con @example.com y válidos según RF-02', async () => {
    const candidates = await loadSeededCandidates();

    expect(new Set(candidates.map((c) => c.email)).size).toBe(30);
    for (const c of candidates) {
      expect(c.email).toMatch(SIMPLE_EMAIL);
      expect(c.fullName).toBe(c.fullName.trim());
      expect(c.fullName.length).toBeGreaterThanOrEqual(2);
      expect(c.fullName.length).toBeLessThanOrEqual(100);
      if (c.phone !== null)
        expect(c.phone).toMatch(new RegExp(candidateFieldsSchema.phone.pattern));
      if (c.summary !== null) expect(c.summary.length).toBeLessThanOrEqual(2000);
      expect(c.skills.length).toBeLessThanOrEqual(4);
      expect(new Set(c.skills).size).toBe(c.skills.length);
      for (const skill of c.skills) expect(skill).toBe(skill.trim().toLowerCase());
    }
    expect(candidates.some((c) => c.phone === null)).toBe(true);
    expect(candidates.some((c) => c.summary === null)).toBe(true);
    expect(candidates.some((c) => c.skills.length === 0)).toBe(true);
  });

  it('RF-08 altas entre 3 y 148 días antes de now, y retiradas siempre ≤ now', async () => {
    const candidates = await loadSeededCandidates();

    for (const c of candidates) {
      const daysAgo = (NOW.getTime() - Date.parse(c.createdAt)) / 86_400_000;
      expect(daysAgo).toBeGreaterThanOrEqual(3);
      expect(daysAgo).toBeLessThanOrEqual(148);
      if (c.consentWithdrawnAt) {
        expect(Date.parse(c.consentWithdrawnAt)).toBeLessThanOrEqual(NOW.getTime());
        expect(c.consentWithdrawnAt > c.consentGivenAt!).toBe(true);
      }
    }
  });

  it('RF-08 ninguno con la retención vencida y cada retentionEndsAt igual a la fórmula', async () => {
    const candidates = await loadSeededCandidates();
    const today = madridCalendarDate(NOW.toISOString());

    for (const c of candidates) {
      expect(c.retentionEndsAt).not.toBeNull();
      expect(c.retentionEndsAt! > today).toBe(true);
      expect(c.retentionEndsAt).toBe(
        computeRetentionEndsAt({
          createdAt: c.createdAt,
          consentGivenAt: c.consentGivenAt,
          consentWithdrawnAt: c.consentWithdrawnAt,
          processes: noCandidateProcesses.getProcesses(c.id),
        }),
      );
    }
  });
});
