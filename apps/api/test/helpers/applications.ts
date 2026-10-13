import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { insertApplicationWithHistory, type SeedStep } from '../../src/db/seed-applications.ts';
import type { JobStatus, JobStatusPort, JobSummary } from '../../src/modules/applications/ports.ts';
import { createApplicationsRepository } from '../../src/modules/applications/repository.ts';
import type {
  Application,
  RejectionReason,
  Stage,
} from '../../src/modules/applications/schemas.ts';

interface JobStatusStubOptions {
  /** `null` = la oferta no existe. */
  status?: JobStatus | null;
  title?: string;
  /** `getJobStatus` lanza un error real sin datos personales (EC-18). */
  fail?: boolean;
  /** `getJobSummary` lanza un error real sin datos personales (EC-21). */
  failSummary?: boolean;
  /** Fecha límite 'AAAA-MM-DD' que devuelve `getEnrollmentDeadline`; `null` = sin plazo. */
  enrollmentDeadline?: string | null;
  /** `getEnrollmentDeadline` lanza un error real sin datos personales. */
  failDeadline?: boolean;
}

/**
 * Doble del puerto «estado de la oferta», sin mocks de módulo: devuelve `status` y `title` (`status: null` = la oferta
 * no existe) o, con `fail`, `failSummary` o `failDeadline`, lanza un error real sin datos personales para probar el 500 y la
 * reversión.
 */
export function createJobStatusStub({
  status = 'published',
  title = 'Oferta de prueba',
  fail = false,
  failSummary = false,
  enrollmentDeadline = null,
  failDeadline = false,
}: JobStatusStubOptions = {}): JobStatusPort {
  return {
    getJobStatus() {
      if (fail) throw new Error('fallo simulado del puerto de estado');
      return status;
    },
    getJobSummary(): JobSummary | null {
      if (failSummary) throw new Error('fallo simulado del resumen de la oferta');
      return status === null ? null : { status, title };
    },
    getEnrollmentDeadline() {
      if (failDeadline) throw new Error('fallo simulado de la fecha límite de la oferta');
      return enrollmentDeadline;
    },
  };
}

/** `POST /api/applications` con `{ jobId, candidateId }`; devuelve la respuesta del `inject` sin interpretarla. */
export function enroll(app: FastifyInstance, jobId: number, candidateId: number) {
  return app.inject({ method: 'POST', url: '/api/applications', payload: { jobId, candidateId } });
}

type Headers = Record<string, string>;

/** `POST /api/applications/:id/advance`; `id` admite texto para probar IDs no válidos. Sin interpretar la respuesta. */
export function advance(
  app: FastifyInstance,
  id: number | string,
  body: unknown,
  headers?: Headers,
) {
  return app.inject({
    method: 'POST',
    url: `/api/applications/${id}/advance`,
    payload: body as object,
    ...(headers ? { headers } : {}),
  });
}

/** `POST /api/applications/:id/reject`; `id` admite texto para probar IDs no válidos. Sin interpretar la respuesta. */
export function reject(
  app: FastifyInstance,
  id: number | string,
  body: unknown,
  headers?: Headers,
) {
  return app.inject({
    method: 'POST',
    url: `/api/applications/${id}/reject`,
    payload: body as object,
    ...(headers ? { headers } : {}),
  });
}

/** `GET /api/applications/:id` (con `query` opcional); `id` admite texto. Sin interpretar la respuesta. */
export function getApplication(
  app: FastifyInstance,
  id: number | string,
  query?: Record<string, string>,
) {
  return app.inject({
    method: 'GET',
    url: `/api/applications/${id}`,
    ...(query ? { query } : {}),
  });
}

export interface InsertApplicationAt {
  jobId: number;
  candidateId: number;
  /** Etapas desde `received`; la última es la etapa actual. */
  path: readonly Stage[];
  /** Instante ISO UTC del primer paso; cada paso siguiente, un minuto después. */
  startAt: string;
  /** Motivo y nota del paso `rejected`. */
  reason?: RejectionReason;
  note?: string;
}

/** Escribe una inscripción ya en cualquier etapa, con un `StageChange` por paso (reloj de pared aparte: no usa `now`). */
export function insertApplicationAt(
  db: DatabaseSync,
  { jobId, candidateId, path, startAt, reason, note }: InsertApplicationAt,
): Application {
  const start = Date.parse(startAt);
  const steps: SeedStep[] = path.map((stage, index) => {
    const at = new Date(start + index * 60_000).toISOString();
    if (stage !== 'rejected') return { stage, at };
    return { stage, at, ...(reason ? { reason } : {}), ...(note !== undefined ? { note } : {}) };
  });
  return insertApplicationWithHistory(createApplicationsRepository(db), {
    candidateId,
    jobId,
    steps,
  });
}

export interface JobStatusSpy {
  port: JobStatusPort;
  /** `db.isTransaction` en cada llamada a `getJobStatus`, en orden (EC-19: la lectura va dentro del `BEGIN IMMEDIATE`). */
  insideTransaction: boolean[];
  /** `db.isTransaction` en cada llamada a `getEnrollmentDeadline`, en orden (HU-07, DEC-08). */
  deadlineInsideTransaction: boolean[];
}

/** Envuelve un puerto (el real o un doble) y registra si cada lectura de estado ocurre dentro de una transacción. */
export function createJobStatusSpy(db: DatabaseSync, inner: JobStatusPort): JobStatusSpy {
  const insideTransaction: boolean[] = [];
  const deadlineInsideTransaction: boolean[] = [];
  const port: JobStatusPort = {
    getJobStatus(jobId) {
      insideTransaction.push(db.isTransaction);
      return inner.getJobStatus(jobId);
    },
    getJobSummary(jobId) {
      return inner.getJobSummary(jobId);
    },
    getEnrollmentDeadline(jobId) {
      deadlineInsideTransaction.push(db.isTransaction);
      return inner.getEnrollmentDeadline(jobId);
    },
  };
  return { port, insideTransaction, deadlineInsideTransaction };
}
