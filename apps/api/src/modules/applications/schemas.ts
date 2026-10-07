import { idParamsSchema } from '../../http/validation.ts';
import type { JobStatus } from './ports.ts';

/** Etapas del proceso, en orden (RV-19). `hired` y `rejected` son finales. */
export const STAGES = ['received', 'screening', 'interview', 'offer', 'hired', 'rejected'] as const;
export type Stage = (typeof STAGES)[number];

/** Motivos de rechazo; `job_closed` solo lo escribe el cierre de la oferta. */
export const REJECTION_REASONS = [
  'not_a_fit',
  'candidate_withdrew',
  'other',
  'job_closed',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];
/** Motivos que puede elegir la persona al rechazar (S-15): nunca `job_closed`. */
export type ManualRejectionReason = Exclude<RejectionReason, 'job_closed'>;

/** ID entero positivo dentro del rango seguro de JavaScript (sin coerción: `"1"` no vale, DEC-11.1). */
const ID = { type: 'integer', minimum: 1, maximum: 9007199254740991 } as const;

/**
 * Cuerpo de `POST /api/applications`. `stage`, `id` o las fechas no se declaran con `forbiddenFields`: EC-01 pide que
 * las claves no declaradas salgan agrupadas en `{ field: 'body', message: 'Hay campos no permitidos.' }`.
 */
export const enrollBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['jobId', 'candidateId'],
  properties: { jobId: ID, candidateId: ID },
} as const;

const STAGE = { type: 'string', enum: STAGES } as const;

/** Cuerpo de `POST /api/applications/:id/advance`; cualquier clave de más sale agrupada en `{ field: 'body' }` (DEC-11.4). */
export const advanceBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['expectedStage', 'toStage'],
  properties: { expectedStage: STAGE, toStage: STAGE },
} as const;

/** Entrada ya validada de `advance`. */
export type AdvanceInput = { expectedStage: Stage; toStage: Stage };

/** Respuesta 201: exactamente los 6 campos de `Application`, sin datos del candidato (RNF-04). */
export const applicationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'jobId', 'candidateId', 'stage', 'createdAt', 'lastChangeAt'],
  properties: {
    id: { type: 'integer' },
    jobId: { type: 'integer' },
    candidateId: { type: 'integer' },
    stage: { type: 'string', enum: STAGES },
    createdAt: { type: 'string' },
    lastChangeAt: { type: 'string' },
  },
} as const;

/** `params` del pipeline: reutiliza el `pattern` del ID de ruta (DEC-11.2); el texto se pasa a `Number()` en la ruta. */
export const pipelineParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['jobId'],
  properties: { jobId: { type: 'string', pattern: idParamsSchema.properties.id.pattern } },
} as const;

/** `querystring` del pipeline: ninguno (sin filtros ni paginación, S-18); cualquier clave es un 400. */
export const pipelineQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
} as const;

/** Respuesta 200: exactamente los 5 campos de `PipelineItem` y el estado de la oferta; nada más puede salir (RNF-04). */
export const pipelineSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['job', 'items'],
  properties: {
    job: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'status'],
      properties: {
        id: { type: 'integer' },
        status: { type: 'string', enum: ['draft', 'published', 'closed'] },
      },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'candidateName', 'stage', 'lastChangeAt', 'rejectionReason'],
        properties: {
          id: { type: 'integer' },
          candidateName: { type: 'string' },
          stage: { type: 'string', enum: STAGES },
          lastChangeAt: { type: 'string' },
          rejectionReason: { type: ['string', 'null'], enum: [...REJECTION_REASONS, null] },
        },
      },
    },
  },
} as const;

/** Entrada ya validada de `enroll`. */
export interface EnrollInput {
  jobId: number;
  candidateId: number;
}

/** Inscripción de un candidato en una oferta. Fechas ISO 8601 UTC (DEC-09). */
export interface Application {
  id: number;
  jobId: number;
  candidateId: number;
  stage: Stage;
  createdAt: string;
  lastChangeAt: string;
}

/** Un paso del historial, del más antiguo al más reciente (orden de `stage_changes.id`). */
export interface StageChangeEntry {
  /** `null` solo en el cambio inicial (INV-04). */
  fromStage: Stage | null;
  toStage: Stage;
  changedAt: string;
  /** No nulo si y solo si `toStage === 'rejected'` (INV-07). */
  reason: RejectionReason | null;
  /** Solo en el cambio de rechazo; único sitio donde sale la nota (RNF-05). */
  note: string | null;
}

/** Una inscripción en el pipeline: solo el nombre del candidato, nunca email, teléfono ni nota (RNF-04). */
export interface PipelineItem {
  id: number;
  candidateName: string;
  stage: Stage;
  lastChangeAt: string;
  /** No nulo si y solo si `stage === 'rejected'`. */
  rejectionReason: RejectionReason | null;
}

/** Pipeline de una oferta: lista plana, `lastChangeAt` y `id` descendentes; la web agrupa por etapa (DD-07). */
export interface Pipeline {
  job: { id: number; status: JobStatus };
  items: PipelineItem[];
}
