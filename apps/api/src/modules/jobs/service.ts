import type { Clock } from '../../clock.ts';
import { validationError } from '../../errors.ts';
import type { JobsRepository } from './repository.ts';
import type { Job, JobInput } from './schemas.ts';

/**
 * Casos de uso de las ofertas. Firma final del diseño (TECHNICAL_DOC-backend § Firmas internas); TASK-04 añade `get` y
 * `list`, y TASK-05 `update` y `remove`. No conoce `request` ni `reply`: los errores salen como `AppError` (DD-10).
 */
export interface JobsService {
  create(input: JobInput): Job;
}

export interface JobsServiceDeps {
  repository: JobsRepository;
  /** Reloj inyectado desde `buildApp` (DEC-09). */
  now: Clock;
  /** `(fn) => withTransaction(db, fn)` (DEC-06). */
  transaction: <T>(fn: () => T) => T;
}

const SALARY_RANGE_MESSAGE = 'El salario mínimo no puede ser mayor que el máximo.';

/** DD-04: mínimo ≤ máximo solo si vienen los dos; el CHECK de la migración 001 es la última defensa. */
function assertSalaryRange(min: number | null | undefined, max: number | null | undefined): void {
  if (min != null && max != null && min > max) {
    throw validationError([{ field: 'salaryMin', message: SALARY_RANGE_MESSAGE }]);
  }
}

export function createJobsService({ repository, now, transaction }: JobsServiceDeps): JobsService {
  return {
    create(input) {
      assertSalaryRange(input.salaryMin, input.salaryMax);
      // `status` ('draft') y `created_at` solo los fija el sistema.
      const createdAt = now().toISOString();
      return transaction(() => repository.insert(input, createdAt));
    },
  };
}
