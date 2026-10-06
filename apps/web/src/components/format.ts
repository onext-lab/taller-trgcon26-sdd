/**
 * Display formats of the web (DD-06, DEC-09): the API speaks UTC and the interface shows dates as
 * `dd/mm/aaaa` in Europe/Madrid, whatever the time zone of the laptop. No date libraries.
 */

export const INVALID_DATE_TEXT = 'Fecha no válida';

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** `2026-10-06T22:30:00.000Z` → «07/10/2026»; an unparseable string → «Fecha no válida». */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? INVALID_DATE_TEXT : dateFormatter.format(date);
}

const integerFormatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

/**
 * `32000` → «32.000». Gotcha: in `es-ES` 4-digit numbers have no grouping separator by default
 * (`4000` → «4000»).
 */
export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}
