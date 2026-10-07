import type { Clock } from '../../clock.ts';
import { duplicate, invalidTransition, notFound } from '../../errors.ts';
import type { CandidateLookupPort, JobStatusPort } from './ports.ts';
import type { ApplicationsRepository, PipelineRow } from './repository.ts';
import type { Application, EnrollInput, Pipeline, PipelineItem } from './schemas.ts';

/**
 * Casos de uso de las inscripciones (TECHNICAL_DOC-backend § Firmas internas). No conoce `request` ni `reply`: los
 * errores salen como `AppError`.
 */
export interface ApplicationsService {
  /**
   * Inscribe un candidato en una oferta publicada, en una sola transacción (DEC-06, DD-02): 404 de la oferta o del
   * candidato, 409 `INVALID_TRANSITION` si la oferta no está publicada y 409 `DUPLICATE` si ya estaba inscrito.
   */
  enroll(input: EnrollInput): Application;
  /**
   * Pipeline de una oferta en cualquier estado (DT-03): 404 si no existe. Lecturas síncronas sin transacción (DD-07).
   */
  getPipeline(jobId: number): Pipeline;
}

export interface ApplicationsServiceDeps {
  repository: ApplicationsRepository;
  /** Reloj inyectado desde `buildApp` (DEC-09). */
  now: Clock;
  /** `(fn) => withTransaction(db, fn)` (DEC-06). */
  transaction: <T>(fn: () => T) => T;
  /** Puerto «estado de la oferta» que implementa `jobs`. */
  jobStatus: JobStatusPort;
  /** Puerto de lectura de candidatos que implementa `candidates`. */
  candidates: CandidateLookupPort;
  /** Operación interna de `candidates` que recalcula `retention_ends_at` (se une a la transacción en curso). */
  recalculateRetention: (candidateId: number) => void;
}

const JOB_NOT_FOUND_MESSAGE = 'La oferta no existe.';
const CANDIDATE_NOT_FOUND_MESSAGE = 'El candidato no existe.';
const NOT_PUBLISHED_MESSAGE = 'La oferta no está publicada: no admite inscripciones.';
const DUPLICATE_MESSAGE = 'Este candidato ya está inscrito en la oferta.';

/** Une cada fila con su nombre; la FK de la base garantiza el candidato, y si no saliera no se inventa un nombre. */
function toPipelineItems(rows: PipelineRow[], names: Map<number, string>): PipelineItem[] {
  return rows.flatMap((row) => {
    const candidateName = names.get(row.candidateId);
    if (candidateName === undefined) return [];
    const { id, stage, lastChangeAt, rejectionReason } = row;
    return [{ id, candidateName, stage, lastChangeAt, rejectionReason }];
  });
}

export function createApplicationsService({
  repository,
  now,
  transaction,
  jobStatus,
  candidates,
  recalculateRetention,
}: ApplicationsServiceDeps): ApplicationsService {
  /** Las tres guardas, en el orden del diseño: oferta (404) → candidato (404) → estado (409). */
  function assertCanEnroll({ jobId, candidateId }: EnrollInput): void {
    const status = jobStatus.getJobStatus(jobId);
    if (status === null) throw notFound(JOB_NOT_FOUND_MESSAGE);
    if (!candidates.exists(candidateId)) throw notFound(CANDIDATE_NOT_FOUND_MESSAGE);
    if (status !== 'published') throw invalidTransition(NOT_PUBLISHED_MESSAGE);
  }

  /** Inserta en `received`; el choque con el índice único (sin `SELECT` previo, DD-03) se traduce en `DUPLICATE`. */
  function insertReceived({ jobId, candidateId }: EnrollInput, instant: string): Application {
    try {
      return repository.insert({
        candidateId,
        jobId,
        stage: 'received',
        createdAt: instant,
        lastChangeAt: instant,
      });
    } catch (error) {
      if (!repository.isDuplicatePairError(error)) throw error;
      // La transacción sigue abierta tras el fallo: el ID del existente es coherente con lo que decidió el índice.
      const existingId = repository.findIdByPair(candidateId, jobId);
      if (existingId === undefined) throw error;
      throw duplicate({ field: 'candidateId', message: DUPLICATE_MESSAGE, existingId });
    }
  }

  function enroll(input: EnrollInput): Application {
    assertCanEnroll(input);
    const instant = now().toISOString();
    const application = insertReceived(input, instant);
    repository.insertStageChange({
      applicationId: application.id,
      fromStage: null,
      toStage: 'received',
      changedAt: instant,
      reason: null,
      note: null,
    });
    recalculateRetention(input.candidateId);
    return application;
  }

  function getPipeline(jobId: number): Pipeline {
    const status = jobStatus.getJobStatus(jobId);
    if (status === null) throw notFound(JOB_NOT_FOUND_MESSAGE);
    const rows = repository.listByJob(jobId);
    const names = candidates.findNames(rows.map((row) => row.candidateId));
    return { job: { id: jobId, status }, items: toPipelineItems(rows, names) };
  }

  return { enroll: (input) => transaction(() => enroll(input)), getPipeline };
}
