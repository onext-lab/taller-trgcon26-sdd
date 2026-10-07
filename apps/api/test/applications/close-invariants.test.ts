import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.ts';
import type { Stage } from '../../src/modules/applications/schemas.ts';
import { insertApplicationAt } from '../helpers/applications.ts';
import { createCandidate } from '../helpers/candidates.ts';
import {
  closeJob,
  createPublishedJob,
  createTestApp,
  createTestClock,
} from '../helpers/test-app.ts';

// HU-06 TASK-03 (INV-05, DD-08): ninguna inscripción no final en una oferta `closed`. CA-15 sobre la base que deja el
// script real de `npm run db:reset` (en un directorio temporal, nunca `data/ats.db`) y CA-16 tras `POST /close`,
// con una misma consulta. Datos inventados.
const OPEN_IN_CLOSED = `SELECT COUNT(*) AS open FROM applications a JOIN job_openings j ON j.id = a.job_id
  WHERE j.status = 'closed' AND a.stage NOT IN ('hired', 'rejected')`;
const APPLICATIONS_IN_CLOSED = `SELECT COUNT(*) AS total FROM applications a JOIN job_openings j ON j.id = a.job_id
  WHERE j.status = 'closed'`;
const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const START_AT = '2026-10-05T09:00:00.000Z';
const CLOSED_AT = '2026-10-06T22:30:00.000Z';
const ACTIVE_STAGES: Stage[] = ['received', 'screening', 'interview', 'offer'];

function scalar(db: DatabaseSync, sql: string, column: string): number {
  return Number(db.prepare(sql).get()?.[column]);
}

describe('CA-15 INV-05 con la base regenerada', () => {
  let tmp: string;
  let db: DatabaseSync;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ats-close-invariants-'));
    const dbPath = join(tmp, 'ats.db');
    execFileSync(process.execPath, ['src/db/reset.ts'], {
      cwd: API_DIR,
      env: { ...process.env, ATS_DB_PATH: dbPath },
      stdio: 'pipe',
    });
    db = openDatabase(dbPath);
  }, 30_000);

  afterAll(() => {
    db?.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('CA-15 INV-05 tras npm run db:reset: 0 inscripciones no finales en ofertas closed', () => {
    // No vacuidad: la base regenerada tiene al menos una oferta cerrada con inscripciones.
    expect(scalar(db, APPLICATIONS_IN_CLOSED, 'total')).toBeGreaterThanOrEqual(1);
    expect(scalar(db, OPEN_IN_CLOSED, 'open')).toBe(0);
  });
});

describe('CA-16 INV-05 tras cerrar por la API', () => {
  const clock = createTestClock(START_AT);
  const { app, db } = createTestApp({ now: clock.now });

  afterEach(() => {
    clock.set(START_AT);
  });

  afterAll(async () => {
    await app.close();
  });

  it('CA-16 INV-05 tras POST /close: 0 no finales en la oferta (received, screening, interview, offer)', async () => {
    const job = await createPublishedJob(app);
    for (const [index, stage] of ACTIVE_STAGES.entries()) {
      const candidate = await createCandidate(app, {
        fullName: `Candidata Inventada ${index + 1}`,
        email: `candidata.invariante.${index + 1}@example.com`,
        phone: `+34 600 000 ${String(index + 1).padStart(3, '0')}`,
        consent: false,
      });
      const path = ACTIVE_STAGES.slice(0, ACTIVE_STAGES.indexOf(stage) + 1);
      insertApplicationAt(db, {
        jobId: job.id,
        candidateId: candidate.id,
        path,
        startAt: START_AT,
      });
    }

    clock.set(CLOSED_AT);
    await closeJob(app, job.id);

    // No vacuidad: la oferta cerrada conserva sus 4 inscripciones, ya todas finales.
    expect(scalar(db, APPLICATIONS_IN_CLOSED, 'total')).toBe(ACTIVE_STAGES.length);
    expect(scalar(db, OPEN_IN_CLOSED, 'open')).toBe(0);
  });
});
