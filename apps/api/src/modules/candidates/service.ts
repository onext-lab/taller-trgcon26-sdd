import type { Clock } from '../../clock.ts';
import { foldSearchText } from '../../db/text-search.ts';
import { duplicate, notFound } from '../../errors.ts';
import type { CandidateProcessesPort } from './processes-port.ts';
import type { CandidateFields, CandidatesRepository } from './repository.ts';
import { computeRetentionEndsAt } from './retention.ts';
import {
  CONSENT_TEXT_VERSION,
  type Candidate,
  type CandidateInput,
  type CandidateListQuery,
  type CandidatePage,
  type CandidatePatch,
} from './schemas.ts';

/**
 * Casos de uso de los candidatos (TECHNICAL_DOC-backend § Firmas internas). No conoce `request` ni `reply`: los
 * errores salen como `AppError`.
 */
export interface CandidatesService {
  /** Filtros en Y (texto plegado en nombre o email, skill exacta), orden `created_at DESC, id DESC` y `total` filtrado (DEC-10). */
  list(query: CandidateListQuery): CandidatePage;
  /** Alta con retención calculada, en una transacción. `DUPLICATE` (409) si el email ya existe. */
  create(input: CandidateInput): Candidate;
  /** `NOT_FOUND` si no existe. */
  get(id: number): Candidate;
  /**
   * Lectura-fusión-escritura de las 5 columnas editables, en una transacción; nunca toca retención ni consentimiento
   * (RN-10). Gana la última escritura (DEC-08). `NOT_FOUND` si no existe, `DUPLICATE` si el email es de otro.
   */
  update(id: number, patch: CandidatePatch): Candidate;
  /** Registrar o renovar el consentimiento (ahora, `v1`, sin retirada) y recalcular la retención. `NOT_FOUND` si no existe. */
  giveConsent(id: number): Candidate;
  /**
   * Retirar el consentimiento vigente y recalcular. Sin uno vigente devuelve la ficha tal cual: sin `now()`, sin
   * escribir y sin recalcular (DD-09). `NOT_FOUND` si no existe.
   */
  withdrawConsent(id: number): Candidate;
  /**
   * Operación interna y único escritor de `retention_ends_at` (DD-05): lee los hechos y el puerto de procesos, aplica
   * la fórmula y guarda. Se une a la transacción en curso. `NOT_FOUND` si no existe.
   */
  recalculateRetention(id: number): Candidate;
  /** Lectura para el puerto de `applications`: ¿existe la ficha? Sin transacción ni columnas. */
  exists(id: number): boolean;
  /** Lectura para el puerto de `applications`: solo `id` → `full_name`. `[]` devuelve un `Map` vacío sin consultar. */
  findNames(ids: readonly number[]): Map<number, string>;
}

export interface CandidatesServiceDeps {
  repository: CandidatesRepository;
  /** Reloj inyectado desde `buildApp` (DEC-09). */
  now: Clock;
  /** `(fn) => withTransaction(db, fn)` (DEC-06). */
  transaction: <T>(fn: () => T) => T;
  /** Puerto hacia `inscripciones`: el lector real de `applications` (HU-04) o un doble en los tests. */
  processes: CandidateProcessesPort;
}

const NOT_FOUND_MESSAGE = 'El candidato no existe.';
const DUPLICATE_MESSAGE = 'Ya existe un candidato con este email.';

function toFields(input: CandidateInput): CandidateFields {
  return {
    fullName: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    summary: input.summary ?? null,
    skills: input.skills ?? [],
  };
}

/** Campos editables tras aplicar el parche: lo ausente conserva el valor de la ficha. */
function mergeFields(current: Candidate, patch: CandidatePatch): CandidateFields {
  return {
    fullName: patch.fullName ?? current.fullName,
    email: patch.email ?? current.email,
    phone: patch.phone === undefined ? current.phone : patch.phone,
    summary: patch.summary === undefined ? current.summary : patch.summary,
    skills: patch.skills ?? current.skills,
  };
}

function requireCandidate(repository: CandidatesRepository, id: number): Candidate {
  const candidate = repository.findById(id);
  if (!candidate) throw notFound(NOT_FOUND_MESSAGE);
  return candidate;
}

/** Único escritor de `retention_ends_at` (DD-05): lee los hechos y el puerto de procesos, aplica la fórmula y guarda. */
function recalculateRetention(
  { repository, transaction, processes }: CandidatesServiceDeps,
  id: number,
): Candidate {
  return transaction(() => {
    const candidate = requireCandidate(repository, id);
    const retentionEndsAt = computeRetentionEndsAt({
      createdAt: candidate.createdAt,
      consentGivenAt: candidate.consentGivenAt,
      consentWithdrawnAt: candidate.consentWithdrawnAt,
      processes: processes.getProcesses(id),
    });
    repository.setRetention(id, retentionEndsAt);
    return requireCandidate(repository, id);
  });
}

/** Ejecuta una escritura y traduce el choque con el `UNIQUE` del email en `DUPLICATE` (DD-04). */
function writeUniqueEmail<T>(repository: CandidatesRepository, email: string, write: () => T): T {
  try {
    return write();
  } catch (error) {
    if (!repository.isDuplicateEmailError(error)) throw error;
    // La transacción sigue abierta tras el fallo (DD-04): el ID del existente es coherente.
    const existingId = repository.findIdByEmail(email);
    if (existingId === undefined) throw error;
    throw duplicate({ field: 'email', message: DUPLICATE_MESSAGE, existingId });
  }
}

function insertCandidate(
  { repository, now }: CandidatesServiceDeps,
  input: CandidateInput,
): number {
  const createdAt = now().toISOString();
  const consent = input.consent ? { givenAt: createdAt, version: CONSENT_TEXT_VERSION } : null;
  return writeUniqueEmail(repository, input.email, () =>
    repository.insert(toFields(input), createdAt, consent),
  );
}

function updateCandidate(
  { repository }: CandidatesServiceDeps,
  id: number,
  patch: CandidatePatch,
): Candidate {
  const fields = mergeFields(requireCandidate(repository, id), patch);
  writeUniqueEmail(repository, fields.email, () => repository.updateFields(id, fields));
  return requireCandidate(repository, id);
}

function giveConsent(deps: CandidatesServiceDeps, id: number): Candidate {
  const { repository, now } = deps;
  requireCandidate(repository, id);
  repository.setConsent(id, {
    givenAt: now().toISOString(),
    version: CONSENT_TEXT_VERSION,
    withdrawnAt: null,
  });
  return recalculateRetention(deps, id);
}

function withdrawConsent(deps: CandidatesServiceDeps, id: number): Candidate {
  const { repository, now } = deps;
  const candidate = requireCandidate(repository, id);
  const hasActiveConsent =
    candidate.consentGivenAt !== null && candidate.consentWithdrawnAt === null;
  if (!hasActiveConsent) return candidate;
  repository.setConsent(id, {
    givenAt: candidate.consentGivenAt,
    version: candidate.consentVersion,
    withdrawnAt: now().toISOString(),
  });
  return recalculateRetention(deps, id);
}

export function createCandidatesService(deps: CandidatesServiceDeps): CandidatesService {
  const { repository, transaction } = deps;
  return {
    list({ q, skill, page, pageSize }) {
      const filter = { q: q ? foldSearchText(q) : null, skill: skill ? skill.toLowerCase() : null };
      const items = repository.listPage(filter, pageSize, (page - 1) * pageSize);
      return { items, total: repository.count(filter), page, pageSize };
    },
    create(input) {
      // Insert con retención `NULL` + recálculo (DD-05): un fallo del puerto deshace también el alta.
      return transaction(() => recalculateRetention(deps, insertCandidate(deps, input)));
    },
    get(id) {
      return requireCandidate(repository, id);
    },
    update: (id, patch) => transaction(() => updateCandidate(deps, id, patch)),
    giveConsent: (id) => transaction(() => giveConsent(deps, id)),
    withdrawConsent: (id) => transaction(() => withdrawConsent(deps, id)),
    recalculateRetention: (id) => recalculateRetention(deps, id),
    exists: (id) => repository.existsById(id),
    findNames: (ids) => (ids.length === 0 ? new Map() : repository.findNamesByIds(ids)),
  };
}
