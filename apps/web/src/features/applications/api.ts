import { badResponseError, isRecord, isValidId, requestJson } from '../../components/http.ts';
import { listCandidates } from '../candidates/api.ts';
import type { CandidatePage } from '../candidates/types.ts';
import { parseRouteId } from '../../components/router.tsx';
import { REJECTION_REASONS, STAGES } from './types.ts';
import type {
  Application,
  EnrollmentInput,
  Pipeline,
  PipelineItem,
  PipelineJobStatus,
} from './types.ts';

const APPLICATIONS_URL = '/api/applications';
const JOB_STATUSES: readonly string[] = [
  'draft',
  'published',
  'closed',
] satisfies PipelineJobStatus[];

/** Candidates shown by the search of the enroll panel (`pageSize` of S6). */
export const SEARCH_LIMIT = 10;

/** `/api/jobs/{id}/applications`; it never builds a URL with an ID that the API would reject. */
export function pipelineUrl(jobId: number): string {
  if (parseRouteId(String(jobId)) === null) throw new RangeError('ID de oferta no válido.');
  return `/api/jobs/${jobId}/applications`;
}

function isOneOf(options: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && options.includes(value);
}

function isPipelineItem(value: unknown): value is PipelineItem {
  if (!isRecord(value)) return false;
  if (!isValidId(value.id) || typeof value.candidateName !== 'string') return false;
  if (!isOneOf(STAGES, value.stage) || typeof value.lastChangeAt !== 'string') return false;
  // `rejectionReason` is not null if and only if the stage is `rejected` (S1).
  if (value.stage === 'rejected') return isOneOf(REJECTION_REASONS, value.rejectionReason);
  return value.rejectionReason === null;
}

/** Minimal shape check of the pipeline: `{ job: { id, status }, items }` (S1). */
export function isPipeline(value: unknown): value is Pipeline {
  if (!isRecord(value) || !isRecord(value.job) || !Array.isArray(value.items)) return false;
  return (
    isValidId(value.job.id) &&
    isOneOf(JOB_STATUSES, value.job.status) &&
    value.items.every(isPipelineItem)
  );
}

export async function getPipeline(jobId: number, signal?: AbortSignal): Promise<Pipeline> {
  const value = await requestJson(pipelineUrl(jobId), { signal });
  if (!isPipeline(value) || value.job.id !== jobId) throw badResponseError();
  return value;
}

/** Minimal shape check of the 201: the six fields of S2. */
export function isApplication(value: unknown): value is Application {
  if (!isRecord(value)) return false;
  return (
    isValidId(value.id) &&
    isValidId(value.jobId) &&
    isValidId(value.candidateId) &&
    isOneOf(STAGES, value.stage) &&
    typeof value.createdAt === 'string' &&
    typeof value.lastChangeAt === 'string'
  );
}

/** `POST /api/applications` → 201 `Application`; the body is exactly `{ jobId, candidateId }`. */
export async function enrollCandidate(
  input: EnrollmentInput,
  signal?: AbortSignal,
): Promise<Application> {
  const body: EnrollmentInput = { jobId: input.jobId, candidateId: input.candidateId };
  const response = await requestJson(APPLICATIONS_URL, { method: 'POST', body, signal });
  if (!isApplication(response)) throw badResponseError();
  return response;
}

/** `GET /api/candidates?q=…&pageSize=10`: the public client of `candidates`, no endpoint of our own. */
export function searchCandidates(q: string, signal?: AbortSignal): Promise<CandidatePage> {
  return listCandidates({ q, pageSize: SEARCH_LIMIT }, signal);
}
