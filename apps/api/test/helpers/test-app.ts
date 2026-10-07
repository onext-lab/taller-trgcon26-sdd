import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../../src/app.ts';
import type { Clock } from '../../src/clock.ts';
import { openDatabase } from '../../src/db/connection.ts';
import { migrate } from '../../src/db/migrate.ts';
import type { JobStatusPort } from '../../src/modules/applications/ports.ts';
import type { CandidateProcessesPort } from '../../src/modules/candidates/processes-port.ts';
import type { JobApplicationsPort } from '../../src/modules/jobs/applications-port.ts';
import type { Job } from '../../src/modules/jobs/schemas.ts';

/**
 * App sobre una base `:memory:` migrada. Quien la use cierra con `await app.close()` en `afterEach`. `now`,
 * `jobApplications`, `candidateProcesses` y `jobStatus` son opcionales: sin ellos, reloj del sistema, el puerto
 * real de `applications` para el cierre de ofertas (HU-06), el lector real de procesos de `applications` (sin
 * inscripciones responde lo mismo que `noCandidateProcesses`) y el lector real del estado de la oferta.
 */
export function createTestApp({
  now,
  jobApplications,
  candidateProcesses,
  jobStatus,
}: {
  now?: Clock;
  jobApplications?: JobApplicationsPort;
  candidateProcesses?: CandidateProcessesPort;
  jobStatus?: JobStatusPort;
} = {}): {
  app: FastifyInstance;
  db: DatabaseSync;
} {
  const db = openDatabase(':memory:');
  migrate(db);
  const app = buildApp({ db, now, jobApplications, candidateProcesses, jobStatus });
  return { app, db };
}

export interface RejectCall {
  jobId: number;
  closedAt: string;
}

export interface ApplicationsSpy {
  port: JobApplicationsPort;
  /** Llamadas recibidas por `rejectActiveApplications`, en orden. */
  rejectCalls: RejectCall[];
}

/**
 * Doble del puerto de inscripciones, sin mocks de módulo: cuenta 0 activas y guarda cada llamada de rechazo. Con
 * `failOnReject` lanza un error real tras guardarla, para probar que el cierre se deshace entero (CA-09).
 */
export function createApplicationsSpy({
  failOnReject = false,
}: { failOnReject?: boolean } = {}): ApplicationsSpy {
  const rejectCalls: RejectCall[] = [];
  const port: JobApplicationsPort = {
    countActiveApplications: () => 0,
    rejectActiveApplications(input) {
      rejectCalls.push(input);
      if (failOnReject) throw new Error('fallo simulado del rechazo');
      return 0;
    },
  };
  return { port, rejectCalls };
}

/** Crea una oferta con `POST /api/jobs` y la devuelve; falla si la respuesta no es 201. */
export async function createJob(app: FastifyInstance, body: Record<string, unknown>): Promise<Job> {
  const response = await app.inject({ method: 'POST', url: '/api/jobs', payload: body });
  if (response.statusCode !== 201) {
    throw new Error(`POST /api/jobs respondió ${response.statusCode}: ${response.body}`);
  }
  return response.json<Job>();
}

async function postAction(
  app: FastifyInstance,
  id: number,
  action: 'publish' | 'close',
): Promise<Job> {
  const response = await app.inject({ method: 'POST', url: `/api/jobs/${id}/${action}` });
  if (response.statusCode !== 200) {
    throw new Error(
      `POST /api/jobs/${id}/${action} respondió ${response.statusCode}: ${response.body}`,
    );
  }
  return response.json<Job>();
}

/** Publica una oferta con `POST /api/jobs/:id/publish` (sin cuerpo); falla si la respuesta no es 200. */
export function publishJob(app: FastifyInstance, id: number): Promise<Job> {
  return postAction(app, id, 'publish');
}

/** Cierra una oferta con `POST /api/jobs/:id/close` (sin cuerpo); falla si la respuesta no es 200. */
export function closeJob(app: FastifyInstance, id: number): Promise<Job> {
  return postAction(app, id, 'close');
}

const PUBLISHABLE_JOB = {
  title: 'Técnica/o de selección',
  description: 'Descripción inventada del puesto.',
  location: 'Valencia',
  workMode: 'híbrida',
  salaryMin: 32000,
  salaryMax: 40000,
};

/** Crea un borrador completo (título, descripción, ubicación y modalidad) y lo publica. `body` pisa los campos. */
export async function createPublishedJob(
  app: FastifyInstance,
  body: Record<string, unknown> = {},
): Promise<Job> {
  const draft = await createJob(app, { ...PUBLISHABLE_JOB, ...body });
  return publishJob(app, draft.id);
}

export type WriteOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface FailWritesTarget {
  /** Tabla sobre la que falla la escritura; `job_openings` por defecto. */
  table?: string;
  /** Solo `UPDATE`: falla únicamente si la sentencia toca esta columna (`UPDATE OF <column>`). */
  column?: string;
}

/**
 * Hace fallar las siguientes escrituras `op` en una tabla (`job_openings` por defecto) con un error real de SQLite
 * (un trigger con `RAISE(ABORT, 'fallo simulado')`), sin mocks. Un trigger por tabla, operación y columna.
 */
export function failWrites(
  db: DatabaseSync,
  op: WriteOperation,
  { table = 'job_openings', column }: FailWritesTarget = {},
): void {
  const suffix = column === undefined ? '' : `_${column}`;
  const name = `fail_${table}_${op.toLowerCase()}${suffix}`;
  const scope = column === undefined ? '' : ` OF ${column}`;
  db.exec(
    `CREATE TRIGGER ${name} BEFORE ${op}${scope} ON ${table} BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END`,
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
