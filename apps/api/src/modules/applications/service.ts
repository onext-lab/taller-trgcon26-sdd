import type { Clock } from '../../clock.ts';
import { duplicate, invalidTransition, notFound, stageMismatch } from '../../errors.ts';
import type { CandidateLookupPort, JobStatusPort } from './ports.ts';
import type { ApplicationsRepository, PipelineRow } from './repository.ts';
import type {
  AdvanceInput,
  Application,
  EnrollInput,
  Pipeline,
  PipelineItem,
  RejectInput,
  RejectionReason,
  Stage,
} from './schemas.ts';
import { decideAdvance, decideReject, isFinal, STAGE_MISMATCH_MESSAGE } from './transitions.ts';

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
  /**
   * Avanza a la etapa siguiente en una transacción (DEC-06): 404, reintento (200 sin escrituras) y 409
   * `STAGE_MISMATCH` / `INVALID_TRANSITION`, en ese orden (DT-02, DT-13). No mira el estado de la oferta (DT-09).
   */
  advance(id: number, input: AdvanceInput): Application;
  /**
   * Rechaza con motivo y nota opcional en una transacción (DEC-06): 404, reintento sobre una rechazada (200 sin
   * escrituras, con cualquier esperada) y 409 `STAGE_MISMATCH` / `INVALID_TRANSITION` (contratada). Sin estado de la
   * oferta (DT-09).
   */
  reject(id: number, input: RejectInput): Application;
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
const APPLICATION_NOT_FOUND_MESSAGE = 'La inscripción no existe.';
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

/** Las tres guardas, en el orden del diseño: oferta (404) → candidato (404) → estado (409). */
function assertCanEnroll(
  { jobStatus, candidates }: ApplicationsServiceDeps,
  input: EnrollInput,
): void {
  const status = jobStatus.getJobStatus(input.jobId);
  if (status === null) throw notFound(JOB_NOT_FOUND_MESSAGE);
  if (!candidates.exists(input.candidateId)) throw notFound(CANDIDATE_NOT_FOUND_MESSAGE);
  if (status !== 'published') throw invalidTransition(NOT_PUBLISHED_MESSAGE);
}

/** Inserta en `received`; el choque con el índice único (sin `SELECT` previo, DD-03) se traduce en `DUPLICATE`. */
function insertReceived(
  { repository }: ApplicationsServiceDeps,
  { jobId, candidateId }: EnrollInput,
  instant: string,
): Application {
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

function enroll(deps: ApplicationsServiceDeps, input: EnrollInput): Application {
  assertCanEnroll(deps, input);
  const instant = deps.now().toISOString();
  const application = insertReceived(deps, input, instant);
  deps.repository.insertStageChange({
    applicationId: application.id,
    fromStage: null,
    toStage: 'received',
    changedAt: instant,
    reason: null,
    note: null,
  });
  deps.recalculateRetention(input.candidateId);
  return application;
}

/** Qué se escribe en el `StageChange`: motivo y nota solo existen en un rechazo (INV-07). */
interface StageChangeRequest {
  toStage: Stage;
  reason: RejectionReason | null;
  note: string | null;
}

/**
 * Escritura compartida por avanzar y rechazar (DD-02): `changedAt` se pide al reloj una sola vez; el `UPDATE` lleva la
 * guarda de la etapa leída en el `WHERE` (0 filas → `STAGE_MISMATCH`); el historial se escribe con el mismo instante y
 * la retención se recalcula solo si la inscripción queda en una etapa final (DD-07). Sin `jobStatus` (DT-09, DD-03).
 */
function applyStageChange(
  deps: ApplicationsServiceDeps,
  application: Application,
  { toStage, reason, note }: StageChangeRequest,
): Application {
  const changedAt = deps.now().toISOString();
  const fromStage = application.stage;
  const updated = deps.repository.updateStage({
    id: application.id,
    fromStage,
    toStage,
    changedAt,
  });
  if (updated === undefined) throw stageMismatch(STAGE_MISMATCH_MESSAGE);
  deps.repository.insertStageChange({
    applicationId: application.id,
    fromStage,
    toStage,
    changedAt,
    reason,
    note,
  });
  if (isFinal(toStage)) deps.recalculateRetention(application.candidateId);
  return updated;
}

/** `noop` devuelve la inscripción leída, sin escrituras ni `now()` (RV-23); `apply` escribe el cambio (DD-05). */
function advance(deps: ApplicationsServiceDeps, id: number, input: AdvanceInput): Application {
  const application = deps.repository.findById(id);
  if (application === undefined) throw notFound(APPLICATION_NOT_FOUND_MESSAGE);
  if (decideAdvance(application.stage, input) === 'noop') return application;
  return applyStageChange(deps, application, { toStage: input.toStage, reason: null, note: null });
}

/** Ya rechazada → `noop` con cualquier esperada: motivo y nota originales intactos, sin escrituras (DT-13, UC-16 · A1). */
function reject(deps: ApplicationsServiceDeps, id: number, input: RejectInput): Application {
  const application = deps.repository.findById(id);
  if (application === undefined) throw notFound(APPLICATION_NOT_FOUND_MESSAGE);
  if (decideReject(application.stage, input.expectedStage) === 'noop') return application;
  return applyStageChange(deps, application, {
    toStage: 'rejected',
    reason: input.reason,
    note: input.note ?? null,
  });
}

function getPipeline(
  { jobStatus, repository, candidates }: ApplicationsServiceDeps,
  jobId: number,
): Pipeline {
  const status = jobStatus.getJobStatus(jobId);
  if (status === null) throw notFound(JOB_NOT_FOUND_MESSAGE);
  const rows = repository.listByJob(jobId);
  const names = candidates.findNames(rows.map((row) => row.candidateId));
  return { job: { id: jobId, status }, items: toPipelineItems(rows, names) };
}

export function createApplicationsService(deps: ApplicationsServiceDeps): ApplicationsService {
  return {
    enroll: (input) => deps.transaction(() => enroll(deps, input)),
    advance: (id, input) => deps.transaction(() => advance(deps, id, input)),
    reject: (id, input) => deps.transaction(() => reject(deps, id, input)),
    getPipeline: (jobId) => getPipeline(deps, jobId),
  };
}
