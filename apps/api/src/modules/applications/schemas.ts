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

/** Inscripción de un candidato en una oferta. Fechas ISO 8601 UTC (DEC-09). */
export interface Application {
  id: number;
  jobId: number;
  candidateId: number;
  stage: Stage;
  createdAt: string;
  lastChangeAt: string;
}
