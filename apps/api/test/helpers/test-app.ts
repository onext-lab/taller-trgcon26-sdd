import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../../src/app.ts';
import type { Clock } from '../../src/clock.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';

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
