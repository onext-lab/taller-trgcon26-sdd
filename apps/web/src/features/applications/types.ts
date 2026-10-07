/**
 * Applications contract consumed by the web. The source of truth is the «Contrato de API» section of
 * `docs/03_delivery/hu/HU-04-inscribir-candidato/plans/TECHNICAL_DOC-backend.md` (assumptions S1-S5 of the
 * frontend design). If it changes, only `types.ts`, `api.ts` and `labels.ts` change.
 */

export const STAGES = ['received', 'screening', 'interview', 'offer', 'hired', 'rejected'] as const;

export type Stage = (typeof STAGES)[number];

export const REJECTION_REASONS = [
  'not_a_fit',
  'candidate_withdrew',
  'other',
  'job_closed',
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

export type PipelineJobStatus = 'draft' | 'published' | 'closed';

/** Card of the pipeline: exactly these five fields (RNF-04); `rejectionReason` is not null only in `rejected`. */
export interface PipelineItem {
  id: number;
  candidateName: string;
  stage: Stage;
  /** ISO 8601 UTC. */
  lastChangeAt: string;
  rejectionReason: RejectionReason | null;
}

/** `GET /api/jobs/:jobId/applications`: a flat list already ordered by the API (DD-08). */
export interface Pipeline {
  job: { id: number; status: PipelineJobStatus };
  items: PipelineItem[];
}

/** Body of `POST /api/applications`. */
export interface EnrollmentInput {
  jobId: number;
  candidateId: number;
}

/** `POST /api/applications` 201: exactly these six fields; `stage` is always `received`. */
export interface Application {
  id: number;
  jobId: number;
  candidateId: number;
  stage: Stage;
  /** ISO 8601 UTC. */
  createdAt: string;
  /** ISO 8601 UTC. */
  lastChangeAt: string;
}
