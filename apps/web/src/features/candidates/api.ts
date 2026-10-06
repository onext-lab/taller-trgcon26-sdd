import { DEFAULT_PAGE_SIZE } from '../../components/list-controls.ts';
import { badResponseError, isRecord, isValidId, requestJson } from '../../components/http.ts';
import { parseCandidateId } from './paths.ts';
import type {
  Candidate,
  CandidateInput,
  CandidateListItem,
  CandidateListParams,
  CandidatePage,
  CandidatePatch,
} from './types.ts';

const CANDIDATES_URL = '/api/candidates';

function candidateUrl(id: number): string {
  // Never build `/api/candidates/{id}` with an ID that the API would reject.
  if (parseCandidateId(String(id)) === null) throw new RangeError('ID de candidato no válido.');
  return `${CANDIDATES_URL}/${id}`;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

// One check per field of `Candidate`: the type forces every field to have its own (S1).
const CANDIDATE_CHECKS: Record<keyof Candidate, (value: unknown) => boolean> = {
  id: isValidId,
  fullName: isString,
  email: isString,
  phone: isNullableString,
  summary: isNullableString,
  skills: isStringArray,
  createdAt: isString,
  consentGivenAt: isNullableString,
  consentVersion: isNullableString,
  consentWithdrawnAt: isNullableString,
  retentionEndsAt: isNullableString,
};

/** Minimal shape check of a full candidate: the 11 fields of S1. */
export function isCandidate(value: unknown): value is Candidate {
  if (!isRecord(value)) return false;
  return Object.entries(CANDIDATE_CHECKS).every(([field, check]) => check(value[field]));
}

function isCandidateListItem(value: unknown): value is CandidateListItem {
  if (!isRecord(value)) return false;
  return (
    isValidId(value.id) &&
    isString(value.fullName) &&
    isString(value.email) &&
    isStringArray(value.skills)
  );
}

/** Minimal shape check of the list page: `{ items, total, page, pageSize }` (S3). */
export function isCandidatePage(value: unknown): value is CandidatePage {
  if (!isRecord(value) || !Array.isArray(value.items)) return false;
  return (
    value.items.every(isCandidateListItem) &&
    Number.isSafeInteger(value.total) &&
    Number.isSafeInteger(value.page) &&
    Number.isSafeInteger(value.pageSize)
  );
}

function expectCandidate(value: unknown): Candidate {
  if (!isCandidate(value)) throw badResponseError();
  return value;
}

/**
 * `/api/candidates` plus the query, in the order `q`, `skill`, `page`, `pageSize`, each value with
 * `encodeURIComponent`. An empty `q` or `skill` and the default `page` (1) and `pageSize` (20) are left out.
 */
export function candidateListUrl(params: CandidateListParams): string {
  const { q = '', skill = '', page = 1, pageSize = DEFAULT_PAGE_SIZE } = params;
  const parts: string[] = [];
  if (q !== '') parts.push(`q=${encodeURIComponent(q)}`);
  if (skill !== '') parts.push(`skill=${encodeURIComponent(skill)}`);
  if (page !== 1) parts.push(`page=${encodeURIComponent(String(page))}`);
  if (pageSize !== DEFAULT_PAGE_SIZE)
    parts.push(`pageSize=${encodeURIComponent(String(pageSize))}`);
  return parts.length === 0 ? CANDIDATES_URL : `${CANDIDATES_URL}?${parts.join('&')}`;
}

export async function listCandidates(
  params: CandidateListParams,
  signal?: AbortSignal,
): Promise<CandidatePage> {
  const value = await requestJson(candidateListUrl(params), { signal });
  if (!isCandidatePage(value)) throw badResponseError();
  return value;
}

export async function getCandidate(id: number, signal?: AbortSignal): Promise<Candidate> {
  return expectCandidate(await requestJson(candidateUrl(id), { signal }));
}

/** `POST /api/candidates` → 201 `Candidate`; the body goes as the form model built it. */
export async function createCandidate(
  input: CandidateInput,
  signal?: AbortSignal,
): Promise<Candidate> {
  const response = await requestJson(CANDIDATES_URL, { method: 'POST', body: input, signal });
  return expectCandidate(response);
}

/** `PATCH /api/candidates/:id` → 200 `Candidate`; only the changed fields travel. */
export async function updateCandidate(
  id: number,
  patch: CandidatePatch,
  signal?: AbortSignal,
): Promise<Candidate> {
  const response = await requestJson(candidateUrl(id), { method: 'PATCH', body: patch, signal });
  return expectCandidate(response);
}

// The consent actions are `POST` without body, so they also go without `Content-Type` (S6, S7).
async function postConsent(id: number, path: string, signal?: AbortSignal): Promise<Candidate> {
  const response = await requestJson(`${candidateUrl(id)}${path}`, { method: 'POST', signal });
  return expectCandidate(response);
}

/** `POST /api/candidates/:id/consent` → 200 `Candidate` with the new date and version. */
export function registerConsent(id: number, signal?: AbortSignal): Promise<Candidate> {
  return postConsent(id, '/consent', signal);
}

/** `POST /api/candidates/:id/consent/withdrawal` → 200 `Candidate` (also when there was nothing to withdraw). */
export function withdrawConsent(id: number, signal?: AbortSignal): Promise<Candidate> {
  return postConsent(id, '/consent/withdrawal', signal);
}
