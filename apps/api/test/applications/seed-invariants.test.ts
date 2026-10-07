import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import { seed } from '../../src/db/seed.ts';
import { createCandidateProcessesReader } from '../../src/modules/applications/candidate-processes.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import {
  addMonthsClamped,
  computeRetentionEndsAt,
  madridCalendarDate,
} from '../../src/modules/candidates/retention.ts';

// Datos inventados. `now` fijo: las inscripciones de las publicadas son relativas al reset (DD-10).
const NOW = new Date('2026-10-06T10:00:00.000Z');
const HOUR_MS = 3_600_000;
const FINAL = ['hired', 'rejected'];
const NEXT: Record<string, string[]> = {
  received: ['screening', 'rejected'],
  screening: ['interview', 'rejected'],
  interview: ['offer', 'rejected'],
  offer: ['hired', 'rejected'],
};

interface Change {
  applicationId: number;
  from: string | null;
  to: string;
  at: string;
  reason: string | null;
  note: string | null;
}

let db: DatabaseSync;

beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  seed(db, NOW);
});

afterEach(() => {
  db.close();
});

function changesByApplication(): Map<number, Change[]> {
  const rows = db
    .prepare(
      `SELECT application_id, from_stage, to_stage, changed_at, reason, note
       FROM stage_changes ORDER BY application_id, id`,
    )
    .all();
  const byApplication = new Map<number, Change[]>();
  for (const row of rows) {
    const change: Change = {
      applicationId: Number(row.application_id),
      from: row.from_stage === null ? null : String(row.from_stage),
      to: String(row.to_stage),
      at: String(row.changed_at),
      reason: row.reason === null ? null : String(row.reason),
      note: row.note === null ? null : String(row.note),
    };
    byApplication.set(change.applicationId, [
      ...(byApplication.get(change.applicationId) ?? []),
      change,
    ]);
  }
  return byApplication;
}

interface AppRow {
  id: number;
  jobId: number;
  candidateId: number;
  stage: string;
  createdAt: string;
  lastChangeAt: string;
  jobStatus: string;
  publishedAt: string;
  closedAt: string | null;
  candidateCreatedAt: string;
}

function applications(): AppRow[] {
  return db
    .prepare(
      `SELECT a.id, a.job_id, a.candidate_id, a.stage, a.created_at, a.last_change_at,
         j.status, j.published_at, j.closed_at, c.created_at AS candidate_created_at
       FROM applications a
       JOIN job_openings j ON j.id = a.job_id
       JOIN candidates c ON c.id = a.candidate_id ORDER BY a.id`,
    )
    .all()
    .map((row) => ({
      id: Number(row.id),
      jobId: Number(row.job_id),
      candidateId: Number(row.candidate_id),
      stage: String(row.stage),
      createdAt: String(row.created_at),
      lastChangeAt: String(row.last_change_at),
      jobStatus: String(row.status),
      publishedAt: String(row.published_at),
      closedAt: row.closed_at === null ? null : String(row.closed_at),
      candidateCreatedAt: String(row.candidate_created_at),
    }));
}

describe('seed de inscripciones — invariantes del historial', () => {
  it('INV-04 cada historial es una cadena válida desde NULL → received', () => {
    const histories = changesByApplication();

    expect(histories.size).toBe(40);
    for (const changes of histories.values()) {
      const [first, ...rest] = changes;
      expect([first?.from, first?.to]).toEqual([null, 'received']);
      let previous = first!.to;
      for (const change of rest) {
        expect(change.from).toBe(previous);
        expect(NEXT[previous]).toContain(change.to);
        previous = change.to;
      }
    }
  });

  it('INV-05 las inscripciones de las ofertas cerradas están solo en hired o rejected', () => {
    const inClosed = applications().filter((app) => app.jobStatus === 'closed');

    expect(inClosed).toHaveLength(10);
    for (const app of inClosed) expect(FINAL).toContain(app.stage);
  });

  it('INV-06 stage = destino del último cambio, last_change_at = su fecha y created_at = la del inicial', () => {
    const histories = changesByApplication();

    for (const app of applications()) {
      const changes = histories.get(app.id)!;
      expect(app.stage).toBe(changes.at(-1)!.to);
      expect(app.lastChangeAt).toBe(changes.at(-1)!.at);
      expect(app.createdAt).toBe(changes[0]!.at);
      const dates = changes.map((change) => change.at);
      expect(dates).toEqual([...dates].sort());
    }
  });

  it('INV-07 job_closed solo en ofertas cerradas, en closed_at y sin nota; ningún otro rechazo sin motivo', () => {
    const histories = changesByApplication();
    let jobClosed = 0;

    for (const app of applications()) {
      for (const change of histories.get(app.id)!) {
        expect(change.reason !== null).toBe(change.to === 'rejected');
        if (change.reason !== 'job_closed') continue;
        jobClosed += 1;
        expect(app.jobStatus).toBe('closed');
        expect(change.at).toBe(app.closedAt);
        expect(change.note).toBeNull();
      }
    }
    expect(jobClosed).toBe(6);
  });
});

describe('seed de inscripciones — fechas', () => {
  it('las fechas de las publicadas caen en (now - 90 h, now - 1 h], tras la publicación y el alta; las cerradas, entre publicación y cierre', () => {
    const histories = changesByApplication();
    const lower = new Date(NOW.getTime() - 90 * HOUR_MS).toISOString();
    const upper = new Date(NOW.getTime() - HOUR_MS).toISOString();

    for (const app of applications()) {
      for (const { at } of histories.get(app.id)!) {
        expect(at > app.publishedAt).toBe(true);
        expect(at > app.candidateCreatedAt).toBe(true);
        if (app.jobStatus === 'published') {
          expect(at > lower).toBe(true);
          expect(at <= upper).toBe(true);
        } else {
          expect(at <= app.closedAt!).toBe(true);
        }
      }
    }
  });
});

interface CandidateRow {
  id: number;
  createdAt: string;
  consentGivenAt: string | null;
  consentWithdrawnAt: string | null;
  retentionEndsAt: string | null;
}

function candidates(): CandidateRow[] {
  return db
    .prepare(
      `SELECT id, created_at, consent_given_at, consent_withdrawn_at, retention_ends_at
       FROM candidates ORDER BY id`,
    )
    .all()
    .map((row) => ({
      id: Number(row.id),
      createdAt: String(row.created_at),
      consentGivenAt: row.consent_given_at === null ? null : String(row.consent_given_at),
      consentWithdrawnAt:
        row.consent_withdrawn_at === null ? null : String(row.consent_withdrawn_at),
      retentionEndsAt: row.retention_ends_at === null ? null : String(row.retention_ends_at),
    }));
}

describe('seed de inscripciones — retención (RF-10, EC-51)', () => {
  it('la retención de cada candidato = fórmula con el puerto real (null con una abierta)', () => {
    const reader = createCandidateProcessesReader(createApplicationsRepository(db));
    let withOpen = 0;

    for (const candidate of candidates()) {
      const processes = reader.getProcesses(candidate.id);
      if (processes.hasOpenApplication) {
        withOpen += 1;
        expect(candidate.retentionEndsAt).toBeNull();
        continue;
      }
      expect(candidate.retentionEndsAt).not.toBeNull();
      expect(candidate.retentionEndsAt).toBe(computeRetentionEndsAt({ ...candidate, processes }));
    }
    // IDs reales de la base. Con alguna abierta: 2-10, 12, 13 y 17-20; el resto de los inscritos (11, 14-16, 21, 26-30) solo tiene finales.
    expect(withOpen).toBe(15);
  });

  it('RF-10 caso mixto: candidato con una inscripción final (hired o rejected) y otra abierta → retención null', () => {
    const mixed = candidates().filter((candidate) => {
      const { total, open } = createApplicationsRepository(db).getProcessFacts(candidate.id);
      return open >= 1 && total > open;
    });

    expect(mixed.length).toBeGreaterThanOrEqual(1);
    for (const candidate of mixed) expect(candidate.retentionEndsAt).toBeNull();
  });

  it('EC-51 candidato con una única inscripción rejected → fecha calculada con lastProcessClosedAt', () => {
    const reader = createCandidateProcessesReader(createApplicationsRepository(db));
    const singles = candidates().filter((candidate) => {
      const { total, open } = createApplicationsRepository(db).getProcessFacts(candidate.id);
      return total === 1 && open === 0;
    });
    const rejected = singles.filter(
      (candidate) =>
        db
          .prepare("SELECT 1 AS n FROM applications WHERE candidate_id = ? AND stage = 'rejected'")
          .get(candidate.id) !== undefined,
    );

    expect(rejected.length).toBeGreaterThanOrEqual(1);
    for (const candidate of rejected) {
      const { lastProcessClosedAt } = reader.getProcesses(candidate.id);
      expect(lastProcessClosedAt).not.toBeNull();
      const fromClosing = addMonthsClamped(madridCalendarDate(lastProcessClosedAt!), 6);
      expect(candidate.retentionEndsAt! >= fromClosing).toBe(true);
      // Sin consentimiento vigente, la fecha es exactamente cierre + 6 meses (no el alta + 6 meses).
      if (candidate.consentGivenAt === null || candidate.consentWithdrawnAt !== null) {
        expect(candidate.retentionEndsAt).toBe(fromClosing);
      }
    }
    expect(rejected.some((c) => c.consentGivenAt === null || c.consentWithdrawnAt !== null)).toBe(
      true,
    );
  });
});
