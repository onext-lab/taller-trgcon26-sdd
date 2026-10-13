import { isCalendarDate } from '../../components/format.ts';
import { badResponseError, isRecord, isValidId, requestJson } from '../../components/http.ts';
import { listCandidates } from '../candidates/api.ts';
import type { CandidatePage } from '../candidates/types.ts';
import { parseRouteId } from '../../components/router.tsx';
import { REJECTION_REASONS, STAGES } from './types.ts';
import type {
  AdvanceInput,
  Application,
  ApplicationDetail,
  EnrollmentInput,
  HistoryEntry,
  Pipeline,
  PipelineItem,
  PipelineJobStatus,
  RejectInput,
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

// `enrollmentDeadline` is `null` or a calendar date; a passed deadline needs a date (it cannot pass without one).
function isDeadlineConsistent(job: Record<string, unknown>): boolean {
  const { enrollmentDeadline, enrollmentDeadlinePassed } = job;
  if (typeof enrollmentDeadlinePassed !== 'boolean') return false;
  if (enrollmentDeadline === null) return !enrollmentDeadlinePassed;
  return typeof enrollmentDeadline === 'string' && isCalendarDate(enrollmentDeadline);
}

/** Minimal shape check of the pipeline: `{ job: { id, status, deadline fields }, items }` (S1, S4). */
export function isPipeline(value: unknown): value is Pipeline {
  if (!isRecord(value) || !isRecord(value.job) || !Array.isArray(value.items)) return false;
  return (
    isValidId(value.job.id) &&
    isOneOf(JOB_STATUSES, value.job.status) &&
    isDeadlineConsistent(value.job) &&
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

/** `/api/applications/{id}`; it never builds a URL with an ID that the API would reject (S8). */
export function applicationUrl(id: number): string {
  if (parseRouteId(String(id)) === null) throw new RangeError('ID de inscripción no válido.');
  return `${APPLICATIONS_URL}/${id}`;
}

// The 200 of advance and reject is the same `Application` of S1 and S2 and must be the requested one.
async function postStageChange(
  id: number,
  action: 'advance' | 'reject',
  body: unknown,
  signal?: AbortSignal,
): Promise<Application> {
  const response = await requestJson(`${applicationUrl(id)}/${action}`, {
    method: 'POST',
    body,
    signal,
  });
  if (!isApplication(response) || response.id !== id) throw badResponseError();
  return response;
}

/** `POST /api/applications/:id/advance` → 200 `Application`; the body is exactly `{ expectedStage, toStage }`. */
export function advanceApplication(
  id: number,
  input: AdvanceInput,
  signal?: AbortSignal,
): Promise<Application> {
  const body: AdvanceInput = { expectedStage: input.expectedStage, toStage: input.toStage };
  return postStageChange(id, 'advance', body, signal);
}

/** `POST /api/applications/:id/reject`: `note` travels only if it is not empty after trimming (S2). */
export function rejectApplication(
  id: number,
  input: RejectInput,
  signal?: AbortSignal,
): Promise<Application> {
  const note = input.note?.trim() ?? '';
  const body: RejectInput = { expectedStage: input.expectedStage, reason: input.reason };
  if (note !== '') body.note = note;
  return postStageChange(id, 'reject', body, signal);
}

// `reason` is not null if and only if the change rejects; `note` is text or null and only in that one (S4).
function isHistoryEntry(value: unknown, first: boolean): value is HistoryEntry {
  if (!isRecord(value) || !isOneOf(STAGES, value.toStage)) return false;
  if (typeof value.changedAt !== 'string') return false;
  if (first ? value.fromStage !== null : !isOneOf(STAGES, value.fromStage)) return false;
  if (value.toStage !== 'rejected') return value.reason === null && value.note === null;
  return (
    isOneOf(REJECTION_REASONS, value.reason) &&
    (value.note === null || typeof value.note === 'string')
  );
}

function isNamed(value: unknown, nameField: string): boolean {
  return isRecord(value) && isValidId(value.id) && typeof value[nameField] === 'string';
}

function isJobSummary(value: unknown): boolean {
  return (
    isNamed(value, 'title') && isOneOf(JOB_STATUSES, (value as Record<string, unknown>).status)
  );
}

/** Shape check of the detail of S4 (DD-09): known stages and reasons, a consistent non-empty history. */
export function isApplicationDetail(value: unknown): value is ApplicationDetail {
  if (!isRecord(value) || !isValidId(value.id) || !isOneOf(STAGES, value.stage)) return false;
  if (typeof value.createdAt !== 'string' || typeof value.lastChangeAt !== 'string') return false;
  if (!isNamed(value.candidate, 'fullName') || !isJobSummary(value.job)) return false;
  const { history } = value;
  return (
    Array.isArray(history) &&
    history.length > 0 &&
    history.every((entry, index) => isHistoryEntry(entry, index === 0))
  );
}

/** `GET /api/applications/:id`; the answer must be the requested application. */
export async function getApplicationDetail(
  id: number,
  signal?: AbortSignal,
): Promise<ApplicationDetail> {
  const value = await requestJson(applicationUrl(id), { signal });
  if (!isApplicationDetail(value) || value.id !== id) throw badResponseError();
  return value;
}
