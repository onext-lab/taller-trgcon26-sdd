import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../../src/app.ts';
import type { Clock } from '../../src/clock.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';

/** App sobre una base `:memory:` migrada. Quien la use cierra con `await app.close()` en `afterEach`. */
export function createTestApp({ now }: { now?: Clock } = {}): {
  app: FastifyInstance;
  db: DatabaseSync;
} {
  const db = openDatabase(':memory:');
  migrate(db);
  const app = buildApp({ db, now });
  return { app, db };
}

/** Crea una oferta con `POST /api/jobs` y la devuelve; falla si la respuesta no es 201. */
export async function createJob(app: FastifyInstance, body: Record<string, unknown>): Promise<Job> {
  const response = await app.inject({ method: 'POST', url: '/api/jobs', payload: body });
  if (response.statusCode !== 201) {
    throw new Error(`POST /api/jobs respondió ${response.statusCode}: ${response.body}`);
  }
  return response.json<Job>();
}

export type WriteOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Hace fallar las siguientes escrituras `op` en job_openings con un error real de SQLite (un trigger con
 * `RAISE(ABORT, 'fallo simulado')`), sin mocks. Un trigger por operación.
 */
export function failWrites(db: DatabaseSync, op: WriteOperation): void {
  const name = `fail_job_openings_${op.toLowerCase()}`;
  db.exec(
    `CREATE TRIGGER ${name} BEFORE ${op} ON job_openings BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END`,
  );
}

export interface TestClock {
  now: Clock;
  set(iso: string): void;
  advance(ms: number): void;
}

/** Reloj controlable para fijar y escalonar fechas (sin `vi.useFakeTimers()`, que congela Fastify). */
export function createTestClock(iso: string): TestClock {
  let current = new Date(iso).getTime();
  return {
    now: () => new Date(current),
    set(next) {
      current = new Date(next).getTime();
    },
    advance(ms) {
      current += ms;
    },
  };
}
