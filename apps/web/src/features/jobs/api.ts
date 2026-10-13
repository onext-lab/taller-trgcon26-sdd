import { isCalendarDate } from '../../components/format.ts';
import { badResponseError, isRecord, requestJson } from '../../components/http.ts';
import { toSearch, type ListQuery } from './list-query.ts';
import { parseJobId } from './paths.ts';
import {
  JOB_STATUSES,
  WORK_MODES,
  type ClosePreview,
  type Job,
  type JobInput,
  type JobListItem,
  type JobPage,
  type JobPatch,
  type JobStatus,
  type WorkMode,
} from './types.ts';

const JOBS_URL = '/api/jobs';

function jobUrl(id: number): string {
  // Never build `/api/jobs/{id}` with an ID that the API would reject (EC-27).
  if (parseJobId(String(id)) === null) throw new RangeError('ID de oferta no válido.');
  return `${JOBS_URL}/${id}`;
}

function isJobStatus(value: unknown): value is JobStatus {
  return (JOB_STATUSES as readonly unknown[]).includes(value);
}

function isWorkMode(value: unknown): value is WorkMode {
  return (WORK_MODES as readonly unknown[]).includes(value);
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isNullableInteger(value: unknown): boolean {
  return value === null || Number.isSafeInteger(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableWorkMode(value: unknown): boolean {
  return value === null || isWorkMode(value);
}

function isNullableCalendarDate(value: unknown): boolean {
  return value === null || (typeof value === 'string' && isCalendarDate(value));
}

// One check per field of `Job`: the type forces every field to have its own.
const JOB_CHECKS: Record<keyof Job, (value: unknown) => boolean> = {
  id: isId,
  title: isString,
  description: isNullableString,
  location: isNullableString,
  workMode: isNullableWorkMode,
  salaryMin: isNullableInteger,
  salaryMax: isNullableInteger,
  status: isJobStatus,
  createdAt: isString,
  publishedAt: isNullableString,
  closedAt: isNullableString,
  enrollmentDeadline: isNullableCalendarDate,
};

/** Minimal shape check of a full job. */
export function isJob(value: unknown): value is Job {
  if (!isRecord(value)) return false;
  return Object.entries(JOB_CHECKS).every(([field, check]) => check(value[field]));
}

function isJobListItem(value: unknown): value is JobListItem {
  if (!isRecord(value)) return false;
  return (
    isId(value.id) &&
    typeof value.title === 'string' &&
    isJobStatus(value.status) &&
    typeof value.referenceDate === 'string'
  );
}

/** Minimal shape check of the list page. */
export function isJobPage(value: unknown): value is JobPage {
  if (!isRecord(value) || !Array.isArray(value.items)) return false;
  return (
    value.items.every(isJobListItem) &&
    Number.isSafeInteger(value.total) &&
    Number.isSafeInteger(value.page) &&
    Number.isSafeInteger(value.pageSize)
  );
}

function expectJob(value: unknown): Job {
  if (!isJob(value)) throw badResponseError();
  return value;
}

/** Minimal shape check of `GET /api/jobs/:id/close-preview`: `activeApplications` is an integer ≥ 0. */
export function isClosePreview(value: unknown): value is ClosePreview {
  if (!isRecord(value)) return false;
  const count = value.activeApplications;
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
}

/** `GET /api/jobs` plus the query in canonical order; `[]` goes without parameters (EC-34). */
export async function listJobs(query: ListQuery, signal?: AbortSignal): Promise<JobPage> {
  const value = await requestJson(`${JOBS_URL}${toSearch(query)}`, { signal });
  if (!isJobPage(value)) throw badResponseError();
  return value;
}

export async function getJob(id: number, signal?: AbortSignal): Promise<Job> {
  return expectJob(await requestJson(jobUrl(id), { signal }));
}

export async function createJob(input: JobInput, signal?: AbortSignal): Promise<Job> {
  return expectJob(await requestJson(JOBS_URL, { method: 'POST', body: input, signal }));
}

export async function updateJob(id: number, patch: JobPatch, signal?: AbortSignal): Promise<Job> {
  return expectJob(await requestJson(jobUrl(id), { method: 'PATCH', body: patch, signal }));
}

/** `DELETE /api/jobs/:id`, without body; the API answers 204. */
export async function deleteJob(id: number, signal?: AbortSignal): Promise<undefined> {
  await requestJson(jobUrl(id), { method: 'DELETE', signal });
  return undefined;
}

/** `GET /api/jobs/:id/close-preview`: how many active applications a close would reject. */
export async function getClosePreview(id: number, signal?: AbortSignal): Promise<ClosePreview> {
  const value = await requestJson(`${jobUrl(id)}/close-preview`, { signal });
  if (!isClosePreview(value)) throw badResponseError();
  return value;
}

// The lifecycle actions are `POST` without body, so they also go without `Content-Type` (EC-01, EC-10).
async function postAction(id: number, action: string, signal?: AbortSignal): Promise<Job> {
  return expectJob(await requestJson(`${jobUrl(id)}/${action}`, { method: 'POST', signal }));
}

/** `POST /api/jobs/:id/publish` → 200 `Job` (also when it was already published). */
export function publishJob(id: number, signal?: AbortSignal): Promise<Job> {
  return postAction(id, 'publish', signal);
}

/** `POST /api/jobs/:id/close` → 200 `Job` (also when it was already closed). */
export function closeJob(id: number, signal?: AbortSignal): Promise<Job> {
  return postAction(id, 'close', signal);
}

/** `POST /api/jobs/:id/duplicate` → 201 `Job`: the new draft. */
export function duplicateJob(id: number, signal?: AbortSignal): Promise<Job> {
  return postAction(id, 'duplicate', signal);
}
