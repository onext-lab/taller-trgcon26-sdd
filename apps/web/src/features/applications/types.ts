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

/** Reasons a person can pick: `job_closed` is set only by the API when a job is closed (never sent). */
export const MANUAL_REJECTION_REASONS = ['not_a_fit', 'candidate_withdrew', 'other'] as const;

export type ManualRejectionReason = (typeof MANUAL_REJECTION_REASONS)[number];

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

/** Body of `POST /api/applications/:id/advance`: exactly these two fields (S1). */
export interface AdvanceInput {
  expectedStage: Stage;
  toStage: Stage;
}

/** Body of `POST /api/applications/:id/reject`: `note` is omitted when empty after trimming (S2). */
export interface RejectInput {
  expectedStage: Stage;
  reason: ManualRejectionReason;
  note?: string;
}

/** One change of stage of the history (S4); `reason` and `note` only in the one that rejects. */
export interface HistoryEntry {
  fromStage: Stage | null;
  toStage: Stage;
  /** ISO 8601 UTC. */
  changedAt: string;
  reason: RejectionReason | null;
  note: string | null;
}

/** `GET /api/applications/:id` (S4): the history goes from the oldest to the most recent change. */
export interface ApplicationDetail {
  id: number;
  stage: Stage;
  /** ISO 8601 UTC. */
  createdAt: string;
  /** ISO 8601 UTC. */
  lastChangeAt: string;
  candidate: { id: number; fullName: string };
  job: { id: number; title: string; status: PipelineJobStatus };
  history: HistoryEntry[];
}
