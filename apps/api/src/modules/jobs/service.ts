import type { Clock } from '../../clock.ts';
import { notFound } from '../../errors.ts';
import type { JobApplicationsPort } from './applications-port.ts';
import type { JobEditableFields, JobsRepository } from './repository.ts';
import { assertNoDetails, checkAction, missingRequiredDetails, salaryRangeDetails } from './rules.ts';
import type { ClosePreview, Job, JobInput, JobPage, JobPatch } from './schemas.ts';

/**
 * Casos de uso de las ofertas. Firma final del diseño (TECHNICAL_DOC-backend § Firmas internas); TASK-04 añade `get` y
 * `list`, y TASK-05 `update` y `remove`. No conoce `request` ni `reply`: los errores salen como `AppError` (DD-10).
 */
export interface JobsService {
  create(input: JobInput): Job;
  /** `NOT_FOUND` si no existe. */
  get(id: number): Job;
  /**
   * Lectura-fusión-escritura (DD-05). `NOT_FOUND` si no existe; `INVALID_TRANSITION` si está `closed`;
   * `VALIDATION_ERROR` si, ya fusionado, mínimo > máximo o falta un obligatorio de una `published`.
   */
  update(id: number, patch: JobPatch): Job;
  /** Borrado físico, solo de un `draft`. `NOT_FOUND` si no existe; `INVALID_TRANSITION` si está `published` o `closed`. */
  remove(id: number): void;
  /** `draft` → `published` con `publishedAt = now()`. Ya publicada: la devuelve igual. 404 · 409 · 400 (campos pendientes). */
  publish(id: number): Job;
  /** `published` → `closed` y rechazo de inscripciones en la misma transacción (DT-02). Ya cerrada: la devuelve igual. */
  close(id: number): Job;
  /** Lectura previa al cierre, en cualquier estado (DD-11). `NOT_FOUND` si no existe. */
  closePreview(id: number): ClosePreview;
  /** Copia de los 6 campos editables como borrador nuevo, desde cualquier estado (DD-09). No es idempotente. */
  duplicate(id: number): Job;
  /** Primera página de 20 (DEC-10); la paginación llega con HU-02. */
  list(): JobPage;
}

export interface JobsServiceDeps {
  repository: JobsRepository;
  /** Reloj inyectado desde `buildApp` (DEC-09). */
  now: Clock;
  /** `(fn) => withTransaction(db, fn)` (DEC-06). */
  transaction: <T>(fn: () => T) => T;
  /** Puerto hacia `inscripciones` (DD-03). */
  applications: JobApplicationsPort;
}

const NOT_FOUND_MESSAGE = 'La oferta no existe.';
const PAGE = 1;
const PAGE_SIZE = 20;

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

function requireJob(repository: JobsRepository, id: number): Job {
  const job = repository.findById(id);
  if (!job) throw notFound(NOT_FOUND_MESSAGE);
  return job;
}

export function createJobsService({
  repository,
  now,
  transaction,
  applications,
}: JobsServiceDeps): JobsService {
  return {
    create(input) {
      assertNoDetails(salaryRangeDetails(input.salaryMin, input.salaryMax));
      // `status` ('draft') y `created_at` solo los fija el sistema.
      const createdAt = now().toISOString();
      return transaction(() => repository.insert(input, createdAt));
    },
    get(id) {
      return requireJob(repository, id);
    },
    update(id, patch) {
      // Orden DT-04: 404 → estado (409) → reglas de campos (400), todo dentro de la transacción (DEC-08).
      return transaction(() => {
        const current = requireJob(repository, id);
        checkAction('update', current.status);
        // Gana la última escritura, campo a campo (DEC-08); las reglas se aplican a lo fusionado (DD-04).
        const merged: JobEditableFields = { ...editableFields(current), ...patch };
        const missing =
          current.status === 'published'
            ? missingRequiredDetails(merged, 'Obligatorio en una oferta publicada.')
            : [];
        // Un único 400 con los obligatorios y, detrás, la banda (DD-07).
        assertNoDetails([...missing, ...salaryRangeDetails(merged.salaryMin, merged.salaryMax)]);
        const updated = repository.update(id, merged);
        if (!updated) throw notFound(NOT_FOUND_MESSAGE);
        return updated;
      });
    },
    remove(id) {
      return transaction(() => {
        const current = requireJob(repository, id);
        checkAction('remove', current.status);
        if (repository.deleteById(id) === 0) throw notFound(NOT_FOUND_MESSAGE);
      });
    },
    publish(id) {
      // Orden DT-04: 404 → estado (409) → reglas de campos (400).
      return transaction(() => {
        const job = requireJob(repository, id);
        if (checkAction('publish', job.status) === 'noop') return job;
        assertNoDetails(missingRequiredDetails(editableFields(job), 'Obligatorio para publicar.'));
        const published = repository.markPublished(id, now().toISOString());
        // Imposible bajo BEGIN IMMEDIATE (DD-08): si ocurre, es un 500.
        if (!published) throw new Error('markPublished no devolvió la fila');
        return published;
      });
    },
    close(id) {
      return transaction(() => {
        const job = requireJob(repository, id);
        if (checkAction('close', job.status) === 'noop') return job; // sin now() ni puerto (S-01)
        const closedAt = now().toISOString();
        const closed = repository.markClosed(id, closedAt);
        if (!closed) throw new Error('markClosed no devolvió la fila');
        // Después del UPDATE y en la misma transacción: si lanza, ROLLBACK.
        applications.rejectActiveApplications({ jobId: id, closedAt });
        return closed;
      });
    },
    closePreview(id) {
      requireJob(repository, id);
      return { activeApplications: applications.countActiveApplications(id) };
    },
    duplicate(id) {
      return transaction(() => {
        const original = requireJob(repository, id);
        return repository.insert(editableFields(original), now().toISOString());
      });
    },
    list() {
      const items = repository.listPage(PAGE_SIZE, (PAGE - 1) * PAGE_SIZE);
      return { items, total: repository.count(), page: PAGE, pageSize: PAGE_SIZE };
    },
  };
}
