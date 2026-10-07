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
