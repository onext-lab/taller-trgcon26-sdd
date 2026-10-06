/**
 * Rules shared by the list screens (jobs, candidates): page sizes the web offers, page count and the
 * validation of a text filter, with the same limits as the API (code points, no C0 control and no DEL).
 */

export const DEFAULT_PAGE_SIZE = 20;
/** The only sizes the web offers (CA-18); the API accepts 1 to 100. */
export const PAGE_SIZES: readonly number[] = [20, 50, 100];

export const MAX_SEARCH_LENGTH = 100;
export const SEARCH_TOO_LONG_TEXT = 'La búsqueda no puede pasar de 100 caracteres.';
export const SEARCH_CONTROL_TEXT = 'La búsqueda no puede tener caracteres de control.';

export type FilterTextResult = { ok: true; value: string } | { ok: false; error: string };
/** Same shape as `FilterTextResult`: the result of validating `q`. */
export type SearchTextResult = FilterTextResult;

export interface FilterTextRules {
  /** Maximum length in code points. */
  maxLength: number;
  tooLong: string;
  control: string;
}

/** A C0 control character (U+0000 to U+001F) or DEL (U+007F) in `text`. */
export function hasControlCharacter(text: string): boolean {
  return Array.from(text).some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f;
  });
}

/** Trims the text; at most `maxLength` code points and no control characters. Empty means no filter. */
export function validateFilterText(raw: string, rules: FilterTextRules): FilterTextResult {
  const value = raw.trim();
  if (Array.from(value).length > rules.maxLength) return { ok: false, error: rules.tooLong };
  if (hasControlCharacter(value)) return { ok: false, error: rules.control };
  return { ok: true, value };
}

/** `q` of a list: at most 100 code points and no control characters (RF-04 of candidates, RF-05 of jobs). */
export function validateSearchText(raw: string): SearchTextResult {
  return validateFilterText(raw, {
    maxLength: MAX_SEARCH_LENGTH,
    tooLong: SEARCH_TOO_LONG_TEXT,
    control: SEARCH_CONTROL_TEXT,
  });
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
