import type { Clock } from '../../clock.ts';
import { notFound, validationError } from '../../errors.ts';
import type { JobEditableFields, JobsRepository } from './repository.ts';
import type { Job, JobInput, JobPage, JobPatch } from './schemas.ts';

/**
 * Casos de uso de las ofertas. Firma final del diseño (TECHNICAL_DOC-backend § Firmas internas); TASK-04 añade `get` y
 * `list`, y TASK-05 `update` y `remove`. No conoce `request` ni `reply`: los errores salen como `AppError` (DD-10).
 */
export interface JobsService {
  create(input: JobInput): Job;
  /** `NOT_FOUND` si no existe. */
  get(id: number): Job;
  /** Lectura-fusión-escritura (DD-05). `NOT_FOUND` si no existe; `VALIDATION_ERROR` si mínimo > máximo fusionados. */
  update(id: number, patch: JobPatch): Job;
  /** Borrado físico. `NOT_FOUND` si no existe. */
  remove(id: number): void;
  /** Primera página de 20 (DEC-10); la paginación llega con HU-02. */
  list(): JobPage;
}

export interface JobsServiceDeps {
  repository: JobsRepository;
  /** Reloj inyectado desde `buildApp` (DEC-09). */
  now: Clock;
  /** `(fn) => withTransaction(db, fn)` (DEC-06). */
  transaction: <T>(fn: () => T) => T;
}

const NOT_FOUND_MESSAGE = 'La oferta no existe.';
const PAGE = 1;
const PAGE_SIZE = 20;

const SALARY_RANGE_MESSAGE = 'El salario mínimo no puede ser mayor que el máximo.';

/** DD-04: mínimo ≤ máximo solo si vienen los dos; el CHECK de la migración 001 es la última defensa. */
function assertSalaryRange(min: number | null | undefined, max: number | null | undefined): void {
  if (min != null && max != null && min > max) {
    throw validationError([{ field: 'salaryMin', message: SALARY_RANGE_MESSAGE }]);
  }
}

/** Solo los 6 campos editables de la oferta guardada: `status` y las fechas nunca entran en la fusión. */
function editableFields({
  title,
  description,
  location,
  workMode,
  salaryMin,
  salaryMax,
}: Job): JobEditableFields {
  return { title, description, location, workMode, salaryMin, salaryMax };
}

export function createJobsService({ repository, now, transaction }: JobsServiceDeps): JobsService {
  return {
    create(input) {
      assertSalaryRange(input.salaryMin, input.salaryMax);
      // `status` ('draft') y `created_at` solo los fija el sistema.
      const createdAt = now().toISOString();
      return transaction(() => repository.insert(input, createdAt));
    },
    get(id) {
      const job = repository.findById(id);
      if (!job) throw notFound(NOT_FOUND_MESSAGE);
      return job;
    },
    update(id, patch) {
      return transaction(() => {
        const current = repository.findById(id);
        if (!current) throw notFound(NOT_FOUND_MESSAGE);
        // Gana la última escritura, campo a campo (DEC-08); la regla de la banda se aplica a lo fusionado (DD-04).
        const merged: JobEditableFields = { ...editableFields(current), ...patch };
        assertSalaryRange(merged.salaryMin, merged.salaryMax);
        const updated = repository.update(id, merged);
        if (!updated) throw notFound(NOT_FOUND_MESSAGE);
        return updated;
      });
    },
    remove(id) {
      if (repository.deleteById(id) === 0) throw notFound(NOT_FOUND_MESSAGE);
    },
    list() {
      const items = repository.listPage(PAGE_SIZE, (PAGE - 1) * PAGE_SIZE);
      return { items, total: repository.count(), page: PAGE, pageSize: PAGE_SIZE };
    },
  };
}
