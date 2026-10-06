import { JOB_STATUSES, type JobStatus } from './types.ts';

// URL of the job list (DD-01). Only `status`, `q`, `page` and `pageSize` are read (repeated ones too) and
// they go to the API raw, without validating: the API decides. Everything else in the URL is ignored.

export const LIST_QUERY_KEYS = ['status', 'q', 'page', 'pageSize'] as const;
export type ListQueryKey = (typeof LIST_QUERY_KEYS)[number];

/** `[key, value]` pairs; `toSearch` writes them in canonical order. `[]` is the plain list. */
export type ListQuery = ReadonlyArray<readonly [ListQueryKey, string]>;

export const DEFAULT_PAGE_SIZE = 20;
/** The only sizes the web offers (CA-18); the API accepts 1 to 100. */
export const PAGE_SIZES: readonly number[] = [20, 50, 100];
export const MAX_SEARCH_LENGTH = 100;
export const SEARCH_TOO_LONG_TEXT = 'La búsqueda no puede pasar de 100 caracteres.';
export const SEARCH_CONTROL_TEXT = 'La búsqueda no puede tener caracteres de control.';

const LIST_PATH = '/jobs';
// Same rule as the API for `pageSize`: 1 to 100, no leading zeros.
const PAGE_SIZE_PATTERN = /^(?:[1-9][0-9]?|100)$/;

function isKnownKey(key: string): key is ListQueryKey {
  return (LIST_QUERY_KEYS as readonly string[]).includes(key);
}

/** The known parameters of a URL query string, repeated ones included, raw. */
export function readListQuery(search: string): ListQuery {
  const pairs: Array<readonly [ListQueryKey, string]> = [];
  for (const [key, value] of new URLSearchParams(search)) {
    if (isKnownKey(key)) pairs.push([key, value]);
  }
  return pairs;
}

/** `?k=v&…` in the order `status`, `q`, `page`, `pageSize`, each value with `encodeURIComponent` (EC-39). */
export function toSearch(query: ListQuery): string {
  const parts: string[] = [];
  for (const key of LIST_QUERY_KEYS) {
    for (const [pairKey, value] of query) {
      if (pairKey === key) parts.push(`${key}=${encodeURIComponent(value)}`);
    }
  }
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

export interface ListView {
  status: JobStatus | '';
  q: string;
  pageSize: number;
}

function firstValue(query: ListQuery, key: ListQueryKey): string | undefined {
  return query.find(([pairKey]) => pairKey === key)?.[1];
}

function isOfferedSize(size: string): boolean {
  return PAGE_SIZE_PATTERN.test(size) && PAGE_SIZES.includes(Number(size));
}

/** Tolerant values for the controls: whatever the URL says, they always show something offered (20, 50, 100). */
export function listView(query: ListQuery): ListView {
  const status = firstValue(query, 'status');
  const size = firstValue(query, 'pageSize');
  return {
    status: JOB_STATUSES.find((value) => value === status) ?? '',
    q: firstValue(query, 'q') ?? '',
    pageSize: size !== undefined && isOfferedSize(size) ? Number(size) : DEFAULT_PAGE_SIZE,
  };
}

/**
 * The query the screen sends: a valid `pageSize` that the web does not offer (e.g. 7) becomes 20, as in the
 * selector (CA-18). Invalid values go raw (the API answers 400, DD-01).
 */
export function listRequest(query: ListQuery): ListQuery {
  return query.map(([key, value]) =>
    key === 'pageSize' && PAGE_SIZE_PATTERN.test(value) && !isOfferedSize(value)
      ? ([key, String(DEFAULT_PAGE_SIZE)] as const)
      : ([key, value] as const),
  );
}

export interface ListChange {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** `/jobs?…` in canonical order, leaving out the defaults (no status, no text, page 1, 20 per page). */
export function listPath(change: ListChange): string {
  const { status = '', q = '', page = 1, pageSize = DEFAULT_PAGE_SIZE } = change;
  const pairs: Array<readonly [ListQueryKey, string]> = [];
  if (status !== '') pairs.push(['status', status]);
  if (q !== '') pairs.push(['q', q]);
  if (page !== 1) pairs.push(['page', String(page)]);
  if (pageSize !== DEFAULT_PAGE_SIZE) pairs.push(['pageSize', String(pageSize)]);
  return `${LIST_PATH}${toSearch(pairs)}`;
}

/** The same filters and size as `query`, on another page. */
export function pagePath(query: ListQuery, page: number): string {
  const { status, q, pageSize } = listView(query);
  return listPath({ status, q, page, pageSize });
}

/** «Quitar filtros»: `/jobs` with no parameters (it also fixes a URL with an invalid `pageSize`). */
export function clearFiltersPath(_query: ListQuery): string {
  return LIST_PATH;
}

/** There is a `status` or a `q` with some value. */
export function hasFilters(query: ListQuery): boolean {
  return query.some(([key, value]) => (key === 'status' || key === 'q') && value !== '');
}

export type SearchTextResult = { ok: true; value: string } | { ok: false; error: string };

function hasControlCharacter(text: string): boolean {
  return Array.from(text).some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f;
  });
}

/** Trims `q`; at most 100 code points and no C0 control or DEL (as the API). Empty means no filter. */
export function validateSearchText(raw: string): SearchTextResult {
  const value = raw.trim();
  if (Array.from(value).length > MAX_SEARCH_LENGTH) {
    return { ok: false, error: SEARCH_TOO_LONG_TEXT };
  }
  if (hasControlCharacter(value)) return { ok: false, error: SEARCH_CONTROL_TEXT };
  return { ok: true, value };
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
