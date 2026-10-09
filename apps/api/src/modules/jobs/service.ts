import type { Clock } from '../../clock.ts';
import { foldSearchText } from '../../db/text-search.ts';
import { invalidTransition, notFound } from '../../errors.ts';
import type { JobApplicationsPort } from './applications-port.ts';
import type { JobEditableFields, JobsRepository } from './repository.ts';
import {
  assertNoDetails,
  checkAction,
  missingRequiredDetails,
  salaryRangeDetails,
} from './rules.ts';
import type { ClosePreview, Job, JobInput, JobListQuery, JobPage, JobPatch } from './schemas.ts';

/**
 * Casos de uso de las ofertas. Firma final del diseño (TECHNICAL_DOC-backend § Firmas internas); `list` recibe los
 * parámetros ya convertidos por la ruta. No conoce `request` ni `reply`: los errores salen como `AppError` (DD-10).
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
  /** Filtros en Y (estado, texto plegado), orden de HU-01 y `total` del resultado filtrado (DEC-10). */
  list(query: JobListQuery): JobPage;
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
// DD-09: inalcanzable por la API (el servicio comprueba antes); distinto de los mensajes de `rules.ts` a propósito.
const STATE_CHANGED_MESSAGE = 'El estado de la oferta ha cambiado: recarga e inténtalo de nuevo.';

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

/**
 * Lectura-fusión-escritura (DD-05), ya dentro de la transacción. Orden DT-04: 404 → estado (409) → reglas de campos
 * (400) (DEC-08).
 */
function updateJob({ repository }: JobsServiceDeps, id: number, patch: JobPatch): Job {
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
  // DD-09: tras `requireJob` y `checkAction`, bajo BEGIN IMMEDIATE, sin fila solo puede ser un estado no permitido.
  if (!updated) throw invalidTransition(STATE_CHANGED_MESSAGE);
  return updated;
}

/** Borrado de un `draft`, ya dentro de la transacción. */
function removeJob({ repository }: JobsServiceDeps, id: number): void {
  const current = requireJob(repository, id);
  checkAction('remove', current.status);
  if (repository.deleteById(id) === 0) throw invalidTransition(STATE_CHANGED_MESSAGE);
}

/** `draft` → `published`, ya dentro de la transacción. Orden DT-04: 404 → estado (409) → reglas de campos (400). */
function publishJob({ repository, now }: JobsServiceDeps, id: number): Job {
  const job = requireJob(repository, id);
  if (checkAction('publish', job.status) === 'noop') return job;
  assertNoDetails(missingRequiredDetails(editableFields(job), 'Obligatorio para publicar.'));
  const published = repository.markPublished(id, now().toISOString());
  // Imposible bajo BEGIN IMMEDIATE (DD-08): si ocurre, es un 500.
  if (!published) throw new Error('markPublished no devolvió la fila');
  return published;
}

/** `published` → `closed` y rechazo de inscripciones, ya dentro de la transacción (DT-02). */
function closeJob({ repository, now, applications }: JobsServiceDeps, id: number): Job {
  const job = requireJob(repository, id);
  if (checkAction('close', job.status) === 'noop') return job; // sin now() ni puerto (S-01)
  const closedAt = now().toISOString();
  const closed = repository.markClosed(id, closedAt);
  if (!closed) throw new Error('markClosed no devolvió la fila');
  // Después del UPDATE y en la misma transacción: si lanza, ROLLBACK.
  applications.rejectActiveApplications({ jobId: id, closedAt });
  return closed;
}

export function createJobsService(deps: JobsServiceDeps): JobsService {
  const { repository, now, transaction, applications } = deps;
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
    update: (id, patch) => transaction(() => updateJob(deps, id, patch)),
    remove: (id) => transaction(() => removeJob(deps, id)),
    publish: (id) => transaction(() => publishJob(deps, id)),
    close: (id) => transaction(() => closeJob(deps, id)),
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
    list({ status, q, page, pageSize }) {
      const filter = { status: status ?? null, q: q ? foldSearchText(q) : null };
      const items = repository.listPage(filter, pageSize, (page - 1) * pageSize);
      return { items, total: repository.count(filter), page, pageSize };
    },
  };
}
