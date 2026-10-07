import type { DatabaseSync } from 'node:sqlite';
import type { JobStatus, JobStatusPort } from '../../src/modules/applications/ports.ts';

/**
 * Doble del puerto «estado de la oferta», sin mocks de módulo: devuelve `status` (`null` = la oferta no existe) o,
 * con `fail`, lanza un error real sin datos personales para probar el 500 y la reversión (EC-18).
 */
export function createJobStatusStub({
  status = 'published',
  fail = false,
}: { status?: JobStatus | null; fail?: boolean } = {}): JobStatusPort {
  return {
    getJobStatus() {
      if (fail) throw new Error('fallo simulado del puerto de estado');
      return status;
    },
  };
}

export interface JobStatusSpy {
  port: JobStatusPort;
  /** `db.isTransaction` en cada llamada a `getJobStatus`, en orden (EC-19: la lectura va dentro del `BEGIN IMMEDIATE`). */
  insideTransaction: boolean[];
}

/** Envuelve un puerto (el real o un doble) y registra si cada lectura ocurre dentro de una transacción. */
export function createJobStatusSpy(db: DatabaseSync, inner: JobStatusPort): JobStatusSpy {
  const insideTransaction: boolean[] = [];
  const port: JobStatusPort = {
    getJobStatus(jobId) {
      insideTransaction.push(db.isTransaction);
      return inner.getJobStatus(jobId);
    },
  };
  return { port, insideTransaction };
}
