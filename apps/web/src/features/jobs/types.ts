/**
 * Jobs contract consumed by the web. The source of truth is the «Contrato de API» section of
 * `docs/03_delivery/hu/HU-01-ofertas-borrador/plans/TECHNICAL_DOC-backend.md`. If it changes, only
 * `types.ts`, `api.ts` and `job-form-model.ts` change.
 */

export const JOB_STATUSES = ['draft', 'published', 'closed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Exact literals of the API; the «í» of «híbrida» is NFC (U+00ED). */
export const WORK_MODES = ['presencial', 'híbrida', 'remota'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

/** Full job (`POST` 201, `GET /:id` 200, `PATCH` 200). Optionals without value are always `null`. */
export interface Job {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  workMode: WorkMode | null;
  salaryMin: number | null;
  salaryMax: number | null;
  status: JobStatus;
  /** ISO 8601 UTC with milliseconds. */
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
}

/** Item of `GET /api/jobs`; `referenceDate = publishedAt ?? createdAt`. */
export interface JobListItem {
  id: number;
  title: string;
  status: JobStatus;
  referenceDate: string;
}

export interface JobPage {
  items: JobListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Body of `POST /api/jobs`: an empty optional is omitted or `null`, never `""`. */
export interface JobInput {
  title: string;
  description?: string | null;
  location?: string | null;
  workMode?: WorkMode | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
}

/** Body of `PATCH /api/jobs/:id`: only the changed fields; `null` empties an optional. */
export type JobPatch = Partial<JobInput>;
