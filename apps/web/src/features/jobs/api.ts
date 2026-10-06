import { badResponseError, isRecord, requestJson } from '../../components/http.ts';
import { parseJobId } from './paths.ts';
import {
  JOB_STATUSES,
  WORK_MODES,
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

/** Minimal shape check of a full job. */
export function isJob(value: unknown): value is Job {
  if (!isRecord(value)) return false;
  return (
    isId(value.id) &&
    typeof value.title === 'string' &&
    isNullableString(value.description) &&
    isNullableString(value.location) &&
    (value.workMode === null || isWorkMode(value.workMode)) &&
    isNullableInteger(value.salaryMin) &&
    isNullableInteger(value.salaryMax) &&
    isJobStatus(value.status) &&
    typeof value.createdAt === 'string' &&
    isNullableString(value.publishedAt) &&
    isNullableString(value.closedAt)
  );
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

/** `GET /api/jobs`, always without query parameters (EC-34). */
export async function listJobs(signal?: AbortSignal): Promise<JobPage> {
  const value = await requestJson(JOBS_URL, { signal });
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
