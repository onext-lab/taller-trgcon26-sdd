import type { Clock } from '../../clock.ts';
import { duplicate, notFound } from '../../errors.ts';
import type { CandidateProcessesPort } from './processes-port.ts';
import type { CandidateFields, CandidatesRepository } from './repository.ts';
import { computeRetentionEndsAt } from './retention.ts';
import { CONSENT_TEXT_VERSION, type Candidate, type CandidateInput } from './schemas.ts';

/**
 * Casos de uso de los candidatos (TECHNICAL_DOC-backend § Firmas internas). No conoce `request` ni `reply`: los
 * errores salen como `AppError`. `update`, `list`, `giveConsent` y `withdrawConsent` llegan en TASK-04 y TASK-05.
 */
export interface CandidatesService {
  /** Alta con retención calculada, en una transacción. `DUPLICATE` (409) si el email ya existe. */
  create(input: CandidateInput): Candidate;
  /** `NOT_FOUND` si no existe. */
  get(id: number): Candidate;
  /**
   * Operación interna y único escritor de `retention_ends_at` (DD-05): lee los hechos y el puerto de procesos, aplica
   * la fórmula y guarda. Se une a la transacción en curso. `NOT_FOUND` si no existe.
   */
  recalculateRetention(id: number): Candidate;
}

export interface CandidatesServiceDeps {
  repository: CandidatesRepository;
  /** Reloj inyectado desde `buildApp` (DEC-09). */
  now: Clock;
  /** `(fn) => withTransaction(db, fn)` (DEC-06). */
  transaction: <T>(fn: () => T) => T;
  /** Puerto hacia `inscripciones`; `noCandidateProcesses` hasta HU-04. */
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

function requireCandidate(repository: CandidatesRepository, id: number): Candidate {
  const candidate = repository.findById(id);
  if (!candidate) throw notFound(NOT_FOUND_MESSAGE);
  return candidate;
}

export function createCandidatesService({
  repository,
  now,
  transaction,
  processes,
}: CandidatesServiceDeps): CandidatesService {
  function recalculateRetention(id: number): Candidate {
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

  function insertCandidate(input: CandidateInput): number {
    const createdAt = now().toISOString();
    const consent = input.consent ? { givenAt: createdAt, version: CONSENT_TEXT_VERSION } : null;
    try {
      return repository.insert(toFields(input), createdAt, consent);
    } catch (error) {
      if (!repository.isDuplicateEmailError(error)) throw error;
      // La transacción sigue abierta tras el fallo (DD-04): el ID del existente es coherente.
      const existingId = repository.findIdByEmail(input.email);
      if (existingId === undefined) throw error;
      throw duplicate({ field: 'email', message: DUPLICATE_MESSAGE, existingId });
    }
  }

  return {
    create(input) {
      // Insert con retención `NULL` + recálculo (DD-05): un fallo del puerto deshace también el alta.
      return transaction(() => recalculateRetention(insertCandidate(input)));
    },
    get(id) {
      return requireCandidate(repository, id);
    },
    recalculateRetention,
  };
}
